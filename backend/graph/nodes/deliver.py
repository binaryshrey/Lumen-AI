# Stage 5: Deliver
# TODO: GCP GCS — generate signed URLs for all accepted clips
# TODO: Build manifest.json with clips, scores, captions, summary stats
# TODO: GCP GCS — upload manifest
# TODO: Supabase — mark orders.status = "completed"

from models.state import PipelineState


async def deliver_node(state: PipelineState) -> dict:
    return {}
