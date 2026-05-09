from supabase import create_client

from config import settings

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


async def update_node_state(
    order_id: str,
    node_id: str,
    patch: dict,
) -> None:
    """Update a single node's state in orders.node_states JSONB."""
    order = supabase.table("orders").select("node_states").eq("id", order_id).single().execute()
    node_states = order.data.get("node_states") or {}
    node_states[node_id] = {**node_states.get(node_id, {}), **patch}

    supabase.table("orders").update({
        "node_states": node_states,
        "current_node": node_id,
    }).eq("id", order_id).execute()
