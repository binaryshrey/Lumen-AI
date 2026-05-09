from pydantic import BaseModel


class WorkflowCreate(BaseModel):
    description: str
    target_minutes: int


class WorkflowResponse(BaseModel):
    id: str
    description: str
    target_minutes: int
    status: str
    current_node: str | None
    node_states: dict
    created_at: str
