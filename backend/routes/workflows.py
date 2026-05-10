import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException

from db import supabase, update_node_state
from graph.pipeline import pipeline
from models.schemas import WorkflowCreate, WorkflowResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])


async def run_pipeline(order_id: str, description: str, target_minutes: int):
    """Run the full LangGraph pipeline in the background."""
    try:
        supabase.table("orders").update({"status": "running"}).eq("id", order_id).execute()
        await update_node_state(order_id, "ml-filters", {"status": "idle"})

        await pipeline.ainvoke({
            "order_id": order_id,
            "description": description,
            "target_minutes": target_minutes,
            "clips": [],
            "gated_clips": [],
            "rejected_count": 0,
            "scored_clips": [],
            "accepted_clips": [],
            "margin_clips": [],
            "rejected_clips": [],
            "node_durations": {},
            "error": None,
        })
    except Exception as e:
        logger.exception(f"Pipeline failed for order {order_id}")
        supabase.table("orders").update({"status": "error"}).eq("id", order_id).execute()
        await update_node_state(order_id, "error", {
            "status": "error",
            "outputPreview": str(e)[:200],
        })


@router.post("", response_model=WorkflowResponse)
async def create_workflow(body: WorkflowCreate, background_tasks: BackgroundTasks):
    result = supabase.table("orders").insert({
        "description": body.description,
        "target_minutes": body.target_minutes,
        "status": "pending",
        "node_states": {},
    }).execute()

    order = result.data[0]

    background_tasks.add_task(
        run_pipeline,
        order["id"],
        body.description,
        body.target_minutes,
    )

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
