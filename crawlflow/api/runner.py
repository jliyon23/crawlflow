"""Run a workflow in a subprocess so Scrapy's reactor stays isolated from the API."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from fastapi import HTTPException

from crawlflow.api.config import LOG_TAIL, PREVIEW_ITEMS, PREVIEW_PAGES, PREVIEW_TIMEOUT, RUN_TIMEOUT
from crawlflow.engine.graph import check
from crawlflow.models.workflow import Workflow, workflow_from_obj


def parse_workflow(payload: dict) -> Workflow:
    try:
        return workflow_from_obj(payload)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc


def execute(workflow: Workflow, *, preview: bool) -> dict:
    if preview:
        settings = workflow.settings
        settings.max_pages = min(settings.max_pages or PREVIEW_PAGES, PREVIEW_PAGES)
        settings.max_items = min(settings.max_items or PREVIEW_ITEMS, PREVIEW_ITEMS)
    timeout = PREVIEW_TIMEOUT if preview else RUN_TIMEOUT
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for node in workflow.nodes:
            if node.type == "output":
                name = Path(node.data.path or f"{node.id}.{node.data.format}").name
                node.data.path = str(tmp_path / name)
        wf_path = tmp_path / "workflow.json"
        report_path = tmp_path / "report.json"
        wf_path.write_text(json.dumps(workflow.model_dump(by_alias=True)))
        cmd = [sys.executable, "-m", "crawlflow", "run", str(wf_path), "--report", str(report_path)]
        try:
            result = subprocess.run(cmd, cwd=str(tmp_path), capture_output=True, text=True, timeout=timeout, check=False)
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(504, f"Run timed out after {exc.timeout}s") from exc
        log = (result.stderr or result.stdout)[-LOG_TAIL:]
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
        "problems": check(workflow),
        "log": log,
    }
