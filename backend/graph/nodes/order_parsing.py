# Stage 1: Order Parsing
# TODO: GCP Gemini Flash — parse user description into structured spec
# - Input: description, target_minutes
# - Output: {keywords, thresholds, quality_tier, content_filters}
# - Use: google.cloud.aiplatform (Vertex AI Gemini Flash)
# - Update orders.node_states via update_node_state()

from models.state import PipelineState


async def order_parsing_node(state: PipelineState) -> dict:
    return {}
