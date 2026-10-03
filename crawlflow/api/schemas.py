from pydantic import BaseModel, Field


class RunBody(BaseModel):
    workflow: dict = Field(..., description="Workflow graph JSON")
    output: str | None = None
    preview: bool = False


class WorkflowBody(BaseModel):
    workflow: dict
