# Stage 3a: Hard Gates (all GCP)
# TODO: GCP Gemini Flash Vision — sharpness/blur detection (rate 0-1)
# TODO: GCP Video Intelligence — Explicit Content Detection (safety gate)
# TODO: GCP Video Intelligence — Label Detection (relevance to order keywords)
# TODO: GCP Cloud Vision — Logo Detection (reject branded content)
# TODO: GCP Cloud Vision — Text Detection / OCR (reject watermarks)
# TODO: Supabase — write filter_scores rows

from models.state import PipelineState


async def hard_gates_node(state: PipelineState) -> dict:
    return {}
