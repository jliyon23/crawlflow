"""One crawl at a time, in a subprocess, tracked as a job directory under runs/."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from fastapi import HTTPException

from crawlflow.api.config import LOG_TAIL, MAX_JOBS, PREVIEW_ITEMS, PREVIEW_PAGES, PREVIEW_TIMEOUT, RUN_TIMEOUT, RUNS
from crawlflow.engine.graph import check
from crawlflow.models.workflow import Workflow, workflow_from_obj

_lock = threading.Lock()
_procs: dict[str, subprocess.Popen[str]] = {}


def parse_workflow(payload: dict) -> Workflow:
    try:
        return workflow_from_obj(payload)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc


def _job_dir(job_id: str) -> Path:
    if not job_id or not all(c in "0123456789abcdef" for c in job_id):
        raise HTTPException(404, "job not found")
    path = RUNS / job_id
    if not path.is_dir():
        raise HTTPException(404, "job not found")
    return path


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}


def _write_meta(directory: Path, meta: dict) -> None:
    (directory / "meta.json").write_text(json.dumps(meta))


def _active_job() -> str | None:
    if not RUNS.exists():
        return None
    for directory in RUNS.iterdir():
        if not directory.is_dir():
            continue
        meta = _read_json(directory / "meta.json")
        if meta.get("status") == "running":
            _settle(directory.name)
            meta = _read_json(directory / "meta.json")
            if meta.get("status") == "running":
                return directory.name
    return None


def _prune() -> None:
    if not RUNS.exists():
        return
    dirs = [p for p in RUNS.iterdir() if p.is_dir()]
    dirs.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    kept = 0
    for directory in dirs:
        meta = _read_json(directory / "meta.json")
        if meta.get("status") == "running":
            continue
        kept += 1
        if kept > MAX_JOBS:
            for child in directory.iterdir():
                child.unlink(missing_ok=True)
            directory.rmdir()


def _alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _stop(job_id: str) -> None:
    proc = _procs.get(job_id)
    if proc and proc.poll() is None:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        except OSError:
            return
        return
    meta = _read_json(RUNS / job_id / "meta.json")
    pid = meta.get("pid")
    if _alive(pid):
        try:
            os.kill(pid, 15)
        except OSError:
            return


def _finish(directory: Path, meta: dict, code: int | None) -> dict:
    if code is None:
        code = 0 if (directory / "report.json").exists() else 1
    meta["returncode"] = code
    meta["status"] = "finished" if code == 0 and (directory / "report.json").exists() else "failed"
    if meta["status"] == "failed" and not meta.get("error"):
        meta["error"] = "run failed"
    _write_meta(directory, meta)
    _procs.pop(meta.get("id"), None)
    return meta


def _settle(job_id: str) -> dict:
    directory = RUNS / job_id
    meta = _read_json(directory / "meta.json")
    if meta.get("status") != "running":
        return meta
    timeout = PREVIEW_TIMEOUT if meta.get("preview") else RUN_TIMEOUT
    started = float(meta.get("started_at") or 0)
    timed_out = time.time() - started > timeout
    proc = _procs.get(job_id)
    if proc is not None:
        code = proc.poll()
        if code is None and not timed_out:
            return meta
        if code is None and timed_out:
            _stop(job_id)
            meta["error"] = f"Run timed out after {timeout}s"
            code = proc.poll()
        return _finish(directory, meta, code if code is not None else 1)
    if _alive(meta.get("pid")) and not timed_out:
        return meta
    if _alive(meta.get("pid")) and timed_out:
        _stop(job_id)
        meta["error"] = f"Run timed out after {timeout}s"
        return _finish(directory, meta, 1)
    return _finish(directory, meta, None)


def start(workflow: Workflow, *, preview: bool) -> dict:
    with _lock:
        active = _active_job()
        if active:
            raise HTTPException(409, "a crawl is already running")
        if preview:
            settings = workflow.settings
            settings.max_pages = min(settings.max_pages or PREVIEW_PAGES, PREVIEW_PAGES)
            settings.max_items = min(settings.max_items or PREVIEW_ITEMS, PREVIEW_ITEMS)
        job_id = uuid.uuid4().hex[:12]
        directory = RUNS / job_id
        directory.mkdir(parents=True)
        for node in workflow.nodes:
            if node.type == "output":
                name = Path(node.data.path or f"{node.id}.{node.data.format}").name
                node.data.path = str(directory / name)
        (directory / "workflow.json").write_text(json.dumps(workflow.model_dump(by_alias=True)))
        log_path = directory / "log.txt"
        log_file = log_path.open("w", encoding="utf-8")
        cmd = [
            sys.executable,
            "-m",
            "crawlflow",
            "run",
            str(directory / "workflow.json"),
            "--report",
            str(directory / "report.json"),
            "--status",
            str(directory / "status.json"),
        ]
        proc = subprocess.Popen(cmd, cwd=str(directory), stdout=log_file, stderr=subprocess.STDOUT, text=True)
        log_file.close()
        meta = {
            "id": job_id,
            "preview": preview,
            "pid": proc.pid,
            "started_at": time.time(),
            "status": "running",
        }
        _write_meta(directory, meta)
        _procs[job_id] = proc
        _prune()
        return {"id": job_id, "status": "running"}


def snapshot(job_id: str) -> dict:
    with _lock:
        directory = _job_dir(job_id)
        meta = _settle(job_id)
    log = ""
    log_path = directory / "log.txt"
    if log_path.exists():
        log = log_path.read_text(errors="replace")[-LOG_TAIL:]
    status_doc = _read_json(directory / "status.json")
    report = _read_json(directory / "report.json") if meta.get("status") != "running" else {}
    outputs = report.get("outputs") or {}
    for entry in outputs.values():
        entry["filename"] = Path(entry.get("filename") or entry.get("path") or "output").name
        entry["path"] = entry["filename"]
    problems: list[str] = []
    if meta.get("status") == "finished":
        workflow_path = directory / "workflow.json"
        if workflow_path.exists():
            problems = check(workflow_from_obj(json.loads(workflow_path.read_text())))
    count = sum(o.get("count", 0) for o in outputs.values()) if outputs else int(status_doc.get("items") or 0)
    return {
        "id": job_id,
        "status": meta.get("status"),
        "preview": bool(meta.get("preview")),
        "pages": int(status_doc.get("pages") or 0),
        "items": int(status_doc.get("items") or count),
        "count": count,
        "outputs": outputs,
        "nodes": report.get("nodes") or {},
        "reason": report.get("reason") or meta.get("error"),
        "problems": problems,
        "log": log,
        "error": meta.get("error"),
    }


def cancel(job_id: str) -> dict:
    with _lock:
        directory = _job_dir(job_id)
        meta = _read_json(directory / "meta.json")
        if meta.get("status") == "running":
            _stop(job_id)
            meta["status"] = "cancelled"
            meta["error"] = "cancelled"
            _write_meta(directory, meta)
            _procs.pop(job_id, None)
    return snapshot(job_id)
