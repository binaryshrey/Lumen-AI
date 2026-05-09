from typing import TypedDict


class PipelineState(TypedDict, total=False):
    # Input
    order_id: str
    description: str
    target_minutes: int

    # Stage 1: Order Parsing
    parsed_query: dict  # {keywords, thresholds, quality_tier, content_filters}

    # Stage 2: Ingest
    clips: list[dict]  # [{clip_id, pexels_url, path, duration_s, frames_dir}]

    # Stage 3a: Hard Gates
    gated_clips: list[dict]
    rejected_count: int

    # Stage 3b: Quality Scoring
    scored_clips: list[dict]  # [{clip_id, aesthetic, semantic, sharpness, motion, combined, caption}]

    # Stage 3c: Decision Split
    accepted_clips: list[dict]
    margin_clips: list[dict]
    rejected_clips: list[dict]

    # Stage 4: Search & Index
    index_path: str
    indexed_count: int

    # Stage 5: Deliver
    manifest_url: str
    summary: dict

    # Metadata
    node_durations: dict  # {node_id: seconds}
    error: str | None
