import tempfile
import time
from pathlib import Path

from db import update_node_state, supabase
from models.state import PipelineState
from services.llm import score_quality
from services.storage import download_file


async def quality_scoring_node(state: PipelineState) -> dict:
    start = time.time()
    order_id = state["order_id"]
    gated = state.get("gated_clips", [])
    description = state.get("description", "")

    await update_node_state(order_id, "ml-quality-scoring", {
        "status": "running",
        "outputPreview": f"Scoring {len(gated)} clips with Gemini Flash Vision...",
    })

    scored = []

    with tempfile.TemporaryDirectory() as tmpdir:
        for i, clip in enumerate(gated):
            gcs_frames = clip.get("gcs_frames", [])
            if not gcs_frames:
                continue

            # Pick up to 4 evenly spaced frames
            if len(gcs_frames) > 4:
                step = (len(gcs_frames) - 1) / 3
                indices = [round(i * step) for i in range(4)]
                frame_keys = [gcs_frames[i] for i in indices]
            else:
                frame_keys = gcs_frames
            local_frames = []
            for j, gcs_path in enumerate(frame_keys):
                local = Path(tmpdir) / f"{clip['pexels_id']}_{j}.jpg"
                download_file(gcs_path, local)
                local_frames.append(local)

            # Score with Gemini Flash Vision
            quality = await score_quality(local_frames, description)

            clip["aesthetic"] = quality["aesthetic_score"]
            clip["semantic"] = quality["semantic_score"]
            clip["motion"] = quality["motion_score"]
            clip["caption"] = quality["caption"]

            # Combined score
            sharpness = clip.get("sharpness", 0.5)
            combined = (
                0.35 * clip["aesthetic"]
                + 0.30 * clip["semantic"]
                + 0.20 * sharpness
                + 0.15 * clip["motion"]
            )
            clip["combined"] = round(combined, 3)

            # Write scores to DB
            for name, val in [("aesthetic", clip["aesthetic"]), ("semantic", clip["semantic"]),
                              ("motion", clip["motion"]), ("combined", combined)]:
                supabase.table("filter_scores").insert({
                    "clip_id": clip["clip_id"],
                    "filter_name": name,
                    "score": val,
                    "details": {"caption": clip["caption"]} if name == "semantic" else {},
                }).execute()

            scored.append(clip)

            await update_node_state(order_id, "ml-quality-scoring", {
                "outputPreview": f"Scored {i + 1}/{len(gated)} clips. Latest: aes={clip['aesthetic']:.2f} sem={clip['semantic']:.2f}",
            })

    # Compute averages
    avg_combined = round(sum(c["combined"] for c in scored) / len(scored), 2) if scored else 0
    duration = round(time.time() - start, 1)

    await update_node_state(order_id, "ml-quality-scoring", {
        "status": "completed",
        "duration": duration,
        "outputPreview": f"Scored {len(scored)} clips. Avg combined: {avg_combined}.",
        "metric": {"label": "AVG SCORE", "value": str(avg_combined)},
    })

    return {
        "scored_clips": scored,
        "node_durations": {**state.get("node_durations", {}), "ml-quality-scoring": duration},
    }
