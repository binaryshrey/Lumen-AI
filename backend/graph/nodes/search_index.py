# Stage 4: Search & Index
# TODO: GCP Vertex AI Multimodal Embeddings — embed frames ($0.0001/image)
# TODO: FAISS IndexHNSWFlat — build vector index (M=32, ef_search=200)
# TODO: DuckDB — write metadata, export as Parquet
# TODO: GCP GCS — upload FAISS index + Parquet
# TODO: Supabase — write embeddings rows

from models.state import PipelineState


async def search_index_node(state: PipelineState) -> dict:
    return {}
