from fastapi import APIRouter, BackgroundTasks, HTTPException

from db import supabase
from models.schemas import WorkflowCreate, WorkflowResponse

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.post("", response_model=WorkflowResponse)
async def create_workflow(body: WorkflowCreate, background_tasks: BackgroundTasks):
    result = supabase.table("orders").insert({
        "description": body.description,
        "target_minutes": body.target_minutes,
        "status": "pending",
        "node_states": {},
    }).execute()

    order = result.data[0]

    return WorkflowResponse(
        id=order["id"],
        description=order["description"],
        target_minutes=order["target_minutes"],
        status=order["status"],
        current_node=order.get("current_node"),
        node_states=order.get("node_states", {}),
        created_at=order["created_at"],
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str):
    result = supabase.table("orders").select("*").eq("id", workflow_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Workflow not found")

    order = result.data
    return WorkflowResponse(
        id=order["id"],
        description=order["description"],
        target_minutes=order["target_minutes"],
        status=order["status"],
        current_node=order.get("current_node"),
        node_states=order.get("node_states", {}),
        created_at=order["created_at"],
    )


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows():
    result = supabase.table("orders").select("*").order("created_at", desc=True).execute()

    return [
        WorkflowResponse(
            id=o["id"],
            description=o["description"],
            target_minutes=o["target_minutes"],
            status=o["status"],
            current_node=o.get("current_node"),
            node_states=o.get("node_states", {}),
            created_at=o["created_at"],
        )
        for o in result.data
    ]
