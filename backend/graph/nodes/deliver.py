import json
import tempfile
import time
from pathlib import Path

from db import update_node_state, supabase
from models.state import PipelineState
from services.storage import upload_bytes, generate_signed_url


async def deliver_node(state: PipelineState) -> dict:
    start = time.time()
    order_id = state["order_id"]
    accepted = state.get("accepted_clips", [])

    await update_node_state(order_id, "deliver", {
        "status": "running",
        "outputPreview": "Packaging manifest...",
    })

    # Generate signed URLs for each clip
    clip_entries = []
    for clip in accepted:
        signed = generate_signed_url(clip["gcs_video"], expiration_minutes=1440)
        clip_entries.append({
            "clip_id": clip["clip_id"],
            "pexels_url": clip.get("pexels_url", ""),
            "download_url": signed,
            "duration_s": clip.get("duration_s", 0),
            "scores": {
                "aesthetic": clip.get("aesthetic", 0),
                "semantic": clip.get("semantic", 0),
                "sharpness": clip.get("sharpness", 0),
                "motion": clip.get("motion", 0),
                "combined": clip.get("combined", 0),
            },
            "caption": clip.get("caption", ""),
        })

    total_duration = sum(c["duration_s"] for c in clip_entries)
    total_minutes = round(total_duration / 60, 1)

    avg = lambda key: round(sum(c["scores"][key] for c in clip_entries) / len(clip_entries), 2) if clip_entries else 0

    manifest = {
        "order_id": order_id,
        "description": state.get("description", ""),
        "quality_summary": {
            "total_clips": len(clip_entries),
            "total_duration_minutes": total_minutes,
            "avg_aesthetic": avg("aesthetic"),
            "avg_semantic": avg("semantic"),
            "avg_sharpness": avg("sharpness"),
            "avg_motion": avg("motion"),
        },
        "clips": clip_entries,
        "index_url": generate_signed_url(state.get("index_path", ""), expiration_minutes=1440) if state.get("index_path") else None,
    }

    # Upload manifest
    gcs_manifest = f"manifests/{order_id}/manifest.json"
    upload_bytes(json.dumps(manifest, indent=2).encode(), gcs_manifest)
    manifest_url = generate_signed_url(gcs_manifest, expiration_minutes=1440)

    # Mark order complete
    supabase.table("orders").update({"status": "completed"}).eq("id", order_id).execute()

    duration = round(time.time() - start, 1)

    await update_node_state(order_id, "deliver", {
        "status": "completed",
        "duration": duration,
        "outputPreview": f"Packaged {len(clip_entries)} clips ({total_minutes} min). Manifest ready.",
        "metric": {"label": "DURATION", "value": f"{total_minutes} min"},
        "manifest_gcs_path": gcs_manifest,
    })

    return {
        "manifest_url": manifest_url,
        "summary": manifest["quality_summary"],
        "node_durations": {**state.get("node_durations", {}), "deliver": duration},
    }
