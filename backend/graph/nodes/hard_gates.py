import tempfile
import time
from pathlib import Path

from db import update_node_state, supabase
from models.state import PipelineState
from services.llm import score_sharpness
from services.vision import analyze_frame
from services.storage import download_file


async def hard_gates_node(state: PipelineState) -> dict:
    start = time.time()
    order_id = state["order_id"]
    clips = state.get("clips", [])
    parsed = state.get("parsed_query", {})
    sharpness_min = parsed.get("thresholds", {}).get("sharpness_min", 0.1)

    await update_node_state(order_id, "ml-hard-gates", {
        "status": "running",
        "outputPreview": f"Running gates on {len(clips)} clips...",
    })

    gated = []
    rejected = 0

    with tempfile.TemporaryDirectory() as tmpdir:
        for clip in clips:
            frames = clip.get("gcs_frames", [])
            if not frames:
                rejected += 1
                continue

            # Download middle frame for analysis
            mid_frame_gcs = frames[len(frames) // 2]
            local_frame = Path(tmpdir) / f"{clip['pexels_id']}_mid.jpg"
            download_file(mid_frame_gcs, local_frame)

            # Gate 1: Sharpness (Gemini Flash)
            sharp = await score_sharpness(local_frame)
            sharpness = sharp.get("sharpness_score", 0)

            if sharpness < sharpness_min:
                _write_score(clip["clip_id"], "sharpness", sharpness, "rejected")
                rejected += 1
                continue

            # Gate 2: Logo + Watermark (Cloud Vision)
            vision_result = analyze_frame(local_frame)

            if vision_result["has_logo"]:
                _write_score(clip["clip_id"], "logo", 1.0, "rejected")
                rejected += 1
                continue

            if vision_result["has_watermark"]:
                _write_score(clip["clip_id"], "watermark", 1.0, "rejected")
                rejected += 1
                continue

            # Passed all gates
            _write_score(clip["clip_id"], "sharpness", sharpness, "passed")
            clip["sharpness"] = sharpness
            gated.append(clip)

            await update_node_state(order_id, "ml-hard-gates", {
                "outputPreview": f"Gated {len(gated) + rejected}/{len(clips)} clips. {rejected} rejected...",
            })

    duration = round(time.time() - start, 1)

    await update_node_state(order_id, "ml-hard-gates", {
        "status": "completed",
        "duration": duration,
        "outputPreview": f"Passed: {len(gated)}, Rejected: {rejected}. {len(gated)}/{len(clips)} forwarded.",
        "metric": {"label": "REJECTED", "value": str(rejected)},
    })

    return {
        "gated_clips": gated,
        "rejected_count": rejected,
        "node_durations": {**state.get("node_durations", {}), "ml-hard-gates": duration},
    }


def _write_score(clip_id: str, filter_name: str, score: float, status: str):
    supabase.table("filter_scores").insert({
        "clip_id": clip_id,
        "filter_name": filter_name,
        "score": score,
        "details": {"status": status},
    }).execute()
