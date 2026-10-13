from fastapi import APIRouter

from crawlflow.api.runner import cancel, parse_workflow, snapshot, start
from crawlflow.api.schemas import RunBody
from crawlflow.engine.graph import check

router = APIRouter(prefix="/api")


@router.post("/validate")
def validate(body: RunBody):
    workflow = parse_workflow(body.workflow)
    return {
        "ok": True,
        "name": workflow.name,
        "nodes": len(workflow.nodes),
        "edges": len(workflow.edges),
        "problems": check(workflow),
    }


@router.post("/runs")
def create_run(body: RunBody):
    return start(parse_workflow(body.workflow), preview=body.preview)


@router.get("/runs/{job_id}")
def get_run(job_id: str):
    return snapshot(job_id)


@router.post("/runs/{job_id}/cancel")
def cancel_run(job_id: str):
    return cancel(job_id)
