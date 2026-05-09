# Stage 3b: Quality Scoring (all GCP)
# TODO: GCP Gemini Flash Vision — aesthetic + semantic + caption (one call per clip)
# TODO: GCP Gemini Flash Vision — motion intensity scoring (rate 0-1)
# TODO: Reuse sharpness score from hard_gates
# TODO: Supabase — write filter_scores rows

from models.state import PipelineState


async def quality_scoring_node(state: PipelineState) -> dict:
    return {}
