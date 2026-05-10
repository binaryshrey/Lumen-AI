import time

from db import update_node_state
from models.state import PipelineState


async def decision_split_node(state: PipelineState) -> dict:
    start = time.time()
    order_id = state["order_id"]
    scored = state.get("scored_clips", [])
    parsed = state.get("parsed_query", {})
    thresholds = parsed.get("thresholds", {})

    accept_thresh = thresholds.get("aesthetic_min", 0.55)
    margin_thresh = max(accept_thresh - 0.2, 0.35)

    await update_node_state(order_id, "ml-decision", {
        "status": "running",
        "outputPreview": "Routing clips by quality score...",
    })

    accepted, margin, rejected = [], [], []

    for clip in scored:
        combined = clip.get("combined", 0)
        if combined > accept_thresh:
            accepted.append(clip)
        elif combined >= margin_thresh:
            margin.append(clip)
        else:
            rejected.append(clip)

    total = len(accepted) + len(margin) + len(rejected)
    accept_rate = round(len(accepted) / total * 100, 1) if total else 0

    duration = round(time.time() - start, 1)

    await update_node_state(order_id, "ml-decision", {
        "status": "completed",
        "duration": duration,
        "outputPreview": f"Accept: {len(accepted)}, Margin: {len(margin)}, Reject: {len(rejected)}. Rate: {accept_rate}%.",
        "metric": {"label": "ACCEPT RATE", "value": f"{accept_rate}%"},
    })

    # Update parent ml-filters node
    parent_duration = sum(
        state.get("node_durations", {}).get(n, 0)
        for n in ["ml-hard-gates", "ml-quality-scoring"]
    ) + duration

    await update_node_state(order_id, "ml-filters", {
        "status": "completed",
        "duration": round(parent_duration, 1),
        "outputPreview": f"Filters complete. {len(accepted)} accepted, {len(margin)} margin, {len(rejected)} rejected.",
        "metric": {"label": "ACCEPT RATE", "value": f"{accept_rate}%"},
    })

    return {
        "accepted_clips": accepted,
        "margin_clips": margin,
        "rejected_clips": rejected,
        "node_durations": {**state.get("node_durations", {}), "ml-decision": duration},
    }
