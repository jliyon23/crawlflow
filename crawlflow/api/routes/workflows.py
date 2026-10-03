from fastapi import APIRouter, HTTPException

from crawlflow.api import repository
from crawlflow.api.config import EXAMPLES, WORKFLOWS
from crawlflow.api.schemas import WorkflowBody
from crawlflow.models.workflow import migrate_legacy, workflow_from_obj

router = APIRouter(prefix="/api")


@router.get("/examples")
def examples():
    return repository.list_documents(EXAMPLES, "example")


@router.get("/examples/{name}")
def example(name: str):
    path = repository.example_path(name)
    if not path.exists():
        raise HTTPException(404, "example not found")
    return repository.load_file(path)


@router.get("/workflows")
def list_workflows():
    saved = repository.list_documents(WORKFLOWS, "saved")
    return saved + examples()


@router.get("/workflows/{name}")
def get_workflow(name: str):
    path = repository.workflow_path(name)
    if path.exists():
        return repository.load_file(path)
    return example(name)


@router.put("/workflows/{name}")
def save_workflow(name: str, body: WorkflowBody):
    workflow_id = repository.save(name, body.workflow)
    return {"ok": True, "id": workflow_id}


@router.post("/normalize")
def normalize(body: WorkflowBody):
    migrated = migrate_legacy(body.workflow)
    try:
        workflow_from_obj(migrated)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    return migrated
