from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from crawlflow.demo import router as demo_router
from crawlflow.graph import check
from crawlflow.schema import migrate_legacy, workflow_from_obj

ROOT = Path(__file__).resolve().parent.parent
EXAMPLES = ROOT / "examples"
WORKFLOWS = ROOT / "workflows"
PREVIEW_PAGES = 10
PREVIEW_ITEMS = 25

app = FastAPI(title="Crawlflow", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(demo_router)


class RunBody(BaseModel):
    workflow: dict = Field(..., description="Workflow graph JSON")
    output: str | None = None
    preview: bool = False


class WorkflowBody(BaseModel):
    workflow: dict


def _safe_id(name: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,80}", name):
        raise HTTPException(400, "workflow id may only contain letters, digits, '-' and '_'")
    return name


def _load(path: Path) -> dict:
    return migrate_legacy(json.loads(path.read_text()))


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/examples")
def examples():
    return [
        {"id": p.stem, "name": json.loads(p.read_text()).get("name", p.stem), "source": "example"}
        for p in sorted(EXAMPLES.glob("*.json"))
    ]


@app.get("/api/examples/{name}")
def example(name: str):
    path = EXAMPLES / f"{_safe_id(name)}.json"
    if not path.exists():
        raise HTTPException(404, "example not found")
    return _load(path)


@app.get("/api/workflows")
def list_workflows():
    saved = [
        {"id": p.stem, "name": json.loads(p.read_text()).get("name", p.stem), "source": "saved"}
        for p in sorted(WORKFLOWS.glob("*.json"))
    ]
    return saved + examples()


@app.get("/api/workflows/{name}")
def get_workflow(name: str):
    path = WORKFLOWS / f"{_safe_id(name)}.json"
    if path.exists():
        return _load(path)
    return example(name)


@app.put("/api/workflows/{name}")
def save_workflow(name: str, body: WorkflowBody):
    try:
        workflow_from_obj(body.workflow)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    WORKFLOWS.mkdir(exist_ok=True)
    payload = {**body.workflow, "id": _safe_id(name)}
    (WORKFLOWS / f"{name}.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    return {"ok": True, "id": name}


@app.post("/api/normalize")
def normalize(body: WorkflowBody):
    migrated = migrate_legacy(body.workflow)
    try:
        workflow_from_obj(migrated)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    return migrated


@app.post("/api/validate")
def validate(body: RunBody):
    try:
        wf = workflow_from_obj(body.workflow)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "name": wf.name, "nodes": len(wf.nodes), "edges": len(wf.edges), "problems": check(wf)}


@app.post("/api/run")
def run(body: RunBody):
    try:
        wf = workflow_from_obj(body.workflow)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    if body.preview:
        s = wf.settings
        s.max_pages = min(s.max_pages or PREVIEW_PAGES, PREVIEW_PAGES)
        s.max_items = min(s.max_items or PREVIEW_ITEMS, PREVIEW_ITEMS)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for node in wf.nodes:
            if node.type == "output":
                name = Path(node.data.path or f"{node.id}.{node.data.format}").name
                node.data.path = str(tmp_path / name)
        wf_path = tmp_path / "workflow.json"
        report_path = tmp_path / "report.json"
        wf_path.write_text(json.dumps(wf.model_dump(by_alias=True)))
        cmd = [sys.executable, "-m", "crawlflow", "run", str(wf_path), "--report", str(report_path)]
        try:
            result = subprocess.run(
                cmd, cwd=str(tmp_path), capture_output=True, text=True, timeout=120 if body.preview else 600, check=False
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(504, f"Run timed out after {exc.timeout}s") from exc
        log = (result.stderr or result.stdout)[-8000:]
        if result.returncode != 0 or not report_path.exists():
            raise HTTPException(status_code=500, detail=log or "run failed")
        report = json.loads(report_path.read_text())
        for entry in report.get("outputs", {}).values():
            entry["filename"] = Path(entry.get("filename") or entry.get("path") or "output").name
            entry["path"] = entry["filename"]

    outputs = report.get("outputs", {})
    return {
        "count": sum(o["count"] for o in outputs.values()),
        "outputs": outputs,
        "nodes": report.get("nodes", {}),
        "reason": report.get("reason"),
        "problems": check(wf),
        "log": log,
    }
