"""JSON files on disk for examples and saved workflows."""

from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import HTTPException

from crawlflow.api.config import EXAMPLES, WORKFLOWS
from crawlflow.models.workflow import migrate_legacy, workflow_from_obj


def safe_id(name: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,80}", name):
        raise HTTPException(400, "workflow id may only contain letters, digits, '-' and '_'")
    return name


def load_file(path: Path) -> dict:
    return migrate_legacy(json.loads(path.read_text()))


def list_documents(directory: Path, source: str) -> list[dict]:
    if not directory.exists():
        return []
    return [
        {"id": path.stem, "name": json.loads(path.read_text()).get("name", path.stem), "source": source}
        for path in sorted(directory.glob("*.json"))
    ]


def example_path(name: str) -> Path:
    return EXAMPLES / f"{safe_id(name)}.json"


def workflow_path(name: str) -> Path:
    return WORKFLOWS / f"{safe_id(name)}.json"


def save(name: str, workflow: dict) -> str:
    workflow_id = safe_id(name)
    try:
        workflow_from_obj(workflow)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    WORKFLOWS.mkdir(exist_ok=True)
    payload = {**workflow, "id": workflow_id}
    workflow_path(workflow_id).write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    return workflow_id
