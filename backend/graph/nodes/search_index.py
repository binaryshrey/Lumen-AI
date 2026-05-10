import json
import tempfile
import time
from pathlib import Path

import duckdb

from db import update_node_state, supabase
from models.state import PipelineState
from services.embeddings import embed_image, build_faiss_index, save_faiss_index
from services.storage import download_file, upload_file


async def search_index_node(state: PipelineState) -> dict:
    start = time.time()
    order_id = state["order_id"]
    accepted = state.get("accepted_clips", [])

    await update_node_state(order_id, "search-index", {
        "status": "running",
        "outputPreview": f"Embedding {len(accepted)} clips...",
    })

    if not accepted:
        await update_node_state(order_id, "search-index", {
            "status": "completed",
            "duration": 0,
            "outputPreview": "No accepted clips to index.",
            "metric": {"label": "INDEXED", "value": "0"},
        })
        return {"index_path": "", "indexed_count": 0}

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        embeddings = []

        # Embed each clip's middle frame
        for i, clip in enumerate(accepted):
            frames = clip.get("gcs_frames", [])
            if not frames:
                continue

            mid_gcs = frames[len(frames) // 2]
            local_frame = tmpdir / f"{clip['pexels_id']}_embed.jpg"
            download_file(mid_gcs, local_frame)

            vec = await embed_image(local_frame)
            embeddings.append(vec)

            # Write embedding record
            supabase.table("embeddings").insert({
                "clip_id": clip["clip_id"],
                "vector_path": f"embeddings/{order_id}/{clip['pexels_id']}.npy",
                "model_version": "multimodalembedding@001",
            }).execute()

            await update_node_state(order_id, "search-index", {
                "outputPreview": f"Embedded {i + 1}/{len(accepted)} clips...",
            })

        # Build FAISS index
        import numpy as np
        matrix = np.array(embeddings, dtype=np.float32)
        index = build_faiss_index(matrix)
        index_path = tmpdir / "faiss.index"
        save_faiss_index(index, index_path)
        gcs_index = f"indexes/{order_id}/faiss.index"
        upload_file(index_path, gcs_index)

        # Build DuckDB metadata → Parquet
        metadata = []
        for clip in accepted:
            metadata.append({
                "clip_id": clip["clip_id"],
                "pexels_id": clip["pexels_id"],
                "aesthetic": clip.get("aesthetic", 0),
                "semantic": clip.get("semantic", 0),
                "motion": clip.get("motion", 0),
                "sharpness": clip.get("sharpness", 0),
                "combined": clip.get("combined", 0),
                "caption": clip.get("caption", ""),
                "duration_s": clip.get("duration_s", 0),
            })

        meta_json = tmpdir / "metadata.json"
        meta_json.write_text(json.dumps(metadata))

        parquet_path = tmpdir / "metadata.parquet"
        con = duckdb.connect()
        con.execute(f"COPY (SELECT * FROM read_json_auto('{meta_json}')) TO '{parquet_path}' (FORMAT PARQUET)")
        con.close()

        gcs_parquet = f"indexes/{order_id}/metadata.parquet"
        upload_file(parquet_path, gcs_parquet)

    duration = round(time.time() - start, 1)

    await update_node_state(order_id, "search-index", {
        "status": "completed",
        "duration": duration,
        "outputPreview": f"Indexed {len(embeddings)} clips. FAISS + Parquet uploaded to GCS.",
        "metric": {"label": "INDEXED", "value": str(len(embeddings))},
    })

    return {
        "index_path": gcs_index,
        "indexed_count": len(embeddings),
        "node_durations": {**state.get("node_durations", {}), "search-index": duration},
    }
