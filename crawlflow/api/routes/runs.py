from fastapi import APIRouter

from crawlflow.api.runner import execute, parse_workflow
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


@router.post("/run")
def run(body: RunBody):
    return execute(parse_workflow(body.workflow), preview=body.preview)
