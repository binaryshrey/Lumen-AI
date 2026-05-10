"""
Test each pipeline node individually.
Run: python test_pipeline.py [node_name]

Examples:
  python test_pipeline.py order_parsing
  python test_pipeline.py ingest
  python test_pipeline.py hard_gates
  python test_pipeline.py quality_scoring
  python test_pipeline.py decision_split
  python test_pipeline.py search_index
  python test_pipeline.py deliver
  python test_pipeline.py all
"""

import asyncio
import json
import sys

from db import supabase


# ── Helpers ──────────────────────────────────────────────────────────────────

def print_state(label: str, data: dict):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(json.dumps(data, indent=2, default=str)[:2000])
    print()


def create_test_order() -> str:
    result = supabase.table("orders").insert({
        "description": "outdoor cooking videos, daytime, no logos",
        "target_minutes": 5,
        "status": "running",
        "node_states": {},
    }).execute()
    order_id = result.data[0]["id"]
    print(f"Created test order: {order_id}")
    return order_id


def get_order(order_id: str) -> dict:
    return supabase.table("orders").select("*").eq("id", order_id).single().execute().data


# ── Node tests ───────────────────────────────────────────────────────────────

async def test_order_parsing(order_id: str, state: dict) -> dict:
    from graph.nodes.order_parsing import order_parsing_node

    print("\n>>> Testing: order_parsing")
    result = await order_parsing_node(state)
    print_state("Parsed Query", result.get("parsed_query", {}))
    return {**state, **result}


async def test_ingest(order_id: str, state: dict) -> dict:
    from graph.nodes.ingest import ingest_node

    print("\n>>> Testing: ingest")
    result = await ingest_node(state)
    clips = result.get("clips", [])
    print(f"Ingested {len(clips)} clips")
    for c in clips[:3]:
        print(f"  {c['pexels_id']} — {c['duration_s']}s — {len(c.get('gcs_frames', []))} frames")
    if len(clips) > 3:
        print(f"  ... and {len(clips) - 3} more")
    return {**state, **result}


async def test_hard_gates(order_id: str, state: dict) -> dict:
    from graph.nodes.hard_gates import hard_gates_node

    print("\n>>> Testing: hard_gates")
    result = await hard_gates_node(state)
    gated = result.get("gated_clips", [])
    rejected = result.get("rejected_count", 0)
    print(f"Passed: {len(gated)}, Rejected: {rejected}")
    for c in gated[:3]:
        print(f"  {c['pexels_id']} — sharpness={c.get('sharpness', '?')}")
    return {**state, **result}


async def test_quality_scoring(order_id: str, state: dict) -> dict:
    from graph.nodes.quality_scoring import quality_scoring_node

    print("\n>>> Testing: quality_scoring")
    result = await quality_scoring_node(state)
    scored = result.get("scored_clips", [])
    print(f"Scored {len(scored)} clips")
    for c in scored[:3]:
        print(f"  {c['pexels_id']} — aes={c.get('aesthetic', '?'):.2f} sem={c.get('semantic', '?'):.2f} "
              f"mot={c.get('motion', '?'):.2f} combined={c.get('combined', '?'):.3f}")
        print(f"    caption: {c.get('caption', '')[:80]}")
    return {**state, **result}


async def test_decision_split(order_id: str, state: dict) -> dict:
    from graph.nodes.decision_split import decision_split_node

    print("\n>>> Testing: decision_split")
    result = await decision_split_node(state)
    accepted = result.get("accepted_clips", [])
    margin = result.get("margin_clips", [])
    rejected = result.get("rejected_clips", [])
    total = len(accepted) + len(margin) + len(rejected)
    rate = round(len(accepted) / total * 100, 1) if total else 0
    print(f"Accept: {len(accepted)}, Margin: {len(margin)}, Reject: {len(rejected)}, Rate: {rate}%")
    return {**state, **result}


async def test_search_index(order_id: str, state: dict) -> dict:
    from graph.nodes.search_index import search_index_node

    print("\n>>> Testing: search_index")
    result = await search_index_node(state)
    print(f"Indexed: {result.get('indexed_count', 0)} clips")
    print(f"Index path: {result.get('index_path', '')}")
    return {**state, **result}


async def test_deliver(order_id: str, state: dict) -> dict:
    from graph.nodes.deliver import deliver_node

    print("\n>>> Testing: deliver")
    result = await deliver_node(state)
    print_state("Summary", result.get("summary", {}))
    manifest_url = result.get("manifest_url", "")
    print(f"Manifest URL: {manifest_url[:100]}...")
    return {**state, **result}


# ── Main ─────────────────────────────────────────────────────────────────────

NODE_TESTS = {
    "order_parsing": test_order_parsing,
    "ingest": test_ingest,
    "hard_gates": test_hard_gates,
    "quality_scoring": test_quality_scoring,
    "decision_split": test_decision_split,
    "search_index": test_search_index,
    "deliver": test_deliver,
}

ALL_NODES = list(NODE_TESTS.keys())


async def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "order_parsing"
    nodes_to_run = ALL_NODES if target == "all" else [target]

    if nodes_to_run[0] not in NODE_TESTS and target != "all":
        print(f"Unknown node: {target}")
        print(f"Available: {', '.join(ALL_NODES)}, all")
        return

    order_id = create_test_order()

    state = {
        "order_id": order_id,
        "description": "outdoor cooking videos, daytime, no logos",
        "target_minutes": 5,
        "node_durations": {},
        # Seed data so individual nodes can run standalone
        "parsed_query": {
            "keywords": ["outdoor cooking", "campfire cooking", "daytime cooking", "nature food"],
            "thresholds": {"aesthetic_min": 0.5, "semantic_min": 0.4, "sharpness_min": 0.1, "motion_max": 0.8},
            "quality_tier": "standard",
            "content_filters": ["no_logos"],
        },
    }

    # If running a single node that depends on earlier nodes, run prerequisites first
    DEPENDS = {
        "ingest": ["order_parsing"],
        "hard_gates": ["order_parsing", "ingest"],
        "quality_scoring": ["order_parsing", "ingest", "hard_gates"],
        "decision_split": ["order_parsing", "ingest", "hard_gates", "quality_scoring"],
        "search_index": ["order_parsing", "ingest", "hard_gates", "quality_scoring", "decision_split"],
        "deliver": ["order_parsing", "ingest", "hard_gates", "quality_scoring", "decision_split", "search_index"],
    }

    if target != "all" and target in DEPENDS:
        print(f"\nRunning prerequisites first: {DEPENDS[target]}")
        for prereq in DEPENDS[target]:
            try:
                state = await NODE_TESTS[prereq](order_id, state)
            except Exception as e:
                print(f"\n!!! Prerequisite {prereq} FAILED: {e}")
                import traceback
                traceback.print_exc()
                return

    for node_name in nodes_to_run:
        try:
            state = await NODE_TESTS[node_name](order_id, state)
        except Exception as e:
            print(f"\n!!! {node_name} FAILED: {e}")
            import traceback
            traceback.print_exc()
            break

    # Print final node_states from Supabase
    order = get_order(order_id)
    print_state("Final node_states in Supabase", order.get("node_states", {}))
    print(f"Order status: {order['status']}")


if __name__ == "__main__":
    asyncio.run(main())
