# Stage 2: Ingest
# TODO: Pexels API — fetch clips by parsed keywords (httpx client)
# TODO: FFmpeg — frame extraction at 1 fps (subprocess)
# TODO: GCP Video Intelligence — Shot Change Detection (replace PySceneDetect)
# TODO: Bloom filter dedup on Pexels video IDs (pybloom_live)
# TODO: GCP GCS — upload clips + frames
# TODO: Supabase — insert clip rows

from models.state import PipelineState


async def ingest_node(state: PipelineState) -> dict:
    return {}
