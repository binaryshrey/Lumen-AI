import tempfile
import time
import uuid
from pathlib import Path

from db import update_node_state, supabase
from models.state import PipelineState
from services.pexels import pexels_client
from services.clip_processing import download_clip, extract_frames
from services.storage import upload_file


async def ingest_node(state: PipelineState) -> dict:
    start = time.time()
    order_id = state["order_id"]
    parsed = state.get("parsed_query", {})
    keywords = parsed.get("keywords", [])

    await update_node_state(order_id, "ingest", {
        "status": "running",
        "outputPreview": f"Searching Pexels for: {keywords[:4]}...",
    })

    # Fetch clips from Pexels (cap to avoid excessive downloads)
    max_clips = min(state.get("target_minutes", 5) * 2, 15)  # ~2 clips per target minute, max 15
    raw_clips = await pexels_client.search_videos(keywords, per_page=5, max_pages=2)
    raw_clips = raw_clips[:max_clips]

    clips = []
    with tempfile.TemporaryDirectory() as tmpdir:
        for clip_meta in raw_clips:
            clip_id = str(uuid.uuid4())
            pexels_id = clip_meta["pexels_id"]

            # Download video
            video_path = Path(tmpdir) / f"{pexels_id}.mp4"
            await download_clip(clip_meta["download_url"], video_path)

            # Extract frames
            frames_dir = Path(tmpdir) / f"{pexels_id}_frames"
            frame_paths = extract_frames(video_path, frames_dir, fps=1)

            # Upload video + frames to GCS
            gcs_video = f"clips/{order_id}/{pexels_id}.mp4"
            upload_file(video_path, gcs_video)

            gcs_frames = []
            for fp in frame_paths:
                gcs_frame = f"frames/{order_id}/{pexels_id}/{fp.name}"
                upload_file(fp, gcs_frame)
                gcs_frames.append(gcs_frame)

            # Insert into Supabase
            supabase.table("clips").insert({
                "id": clip_id,
                "order_id": order_id,
                "pexels_url": clip_meta["pexels_url"],
                "pexels_id": pexels_id,
                "path": gcs_video,
                "duration_s": clip_meta["duration_s"],
                "width": clip_meta["width"],
                "height": clip_meta["height"],
                "metadata": {"frame_count": len(frame_paths), "gcs_frames": gcs_frames},
            }).execute()

            clips.append({
                "clip_id": clip_id,
                "pexels_id": pexels_id,
                "pexels_url": clip_meta["pexels_url"],
                "gcs_video": gcs_video,
                "gcs_frames": gcs_frames,
                "duration_s": clip_meta["duration_s"],
            })

            await update_node_state(order_id, "ingest", {
                "outputPreview": f"Fetched {len(clips)}/{len(raw_clips)} clips...",
            })

    duration = round(time.time() - start, 1)
    total_frames = sum(len(c["gcs_frames"]) for c in clips)

    await update_node_state(order_id, "ingest", {
        "status": "completed",
        "duration": duration,
        "outputPreview": f"Fetched {len(clips)} clips. Extracted {total_frames} frames. Uploaded to GCS.",
        "metric": {"label": "CLIPS", "value": str(len(clips))},
    })

    return {
        "clips": clips,
        "node_durations": {**state.get("node_durations", {}), "ingest": duration},
    }
