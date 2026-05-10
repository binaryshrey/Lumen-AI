import time

from db import update_node_state, supabase
from models.state import PipelineState
from services.llm import parse_order


async def order_parsing_node(state: PipelineState) -> dict:
    start = time.time()
    order_id = state["order_id"]

    await update_node_state(order_id, "order-parsing", {
        "status": "running",
        "outputPreview": "Parsing prompt with Gemini Flash...",
    })

    parsed = await parse_order(state["description"], state["target_minutes"])

    # Save parsed query to orders table
    supabase.table("orders").update({
        "parsed_query": parsed,
    }).eq("id", order_id).execute()

    duration = round(time.time() - start, 1)

    await update_node_state(order_id, "order-parsing", {
        "status": "completed",
        "duration": duration,
        "outputPreview": f'Parsed {len(parsed["keywords"])} keywords: {parsed["keywords"]}. Tier: {parsed["quality_tier"]}.',
        "metric": {"label": "KEYWORDS", "value": str(len(parsed["keywords"]))},
    })

    return {
        "parsed_query": parsed,
        "node_durations": {**state.get("node_durations", {}), "order-parsing": duration},
    }
