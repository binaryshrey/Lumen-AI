import asyncio as _asyncio
import logging
from pathlib import Path

import numpy as np
import vertexai
from vertexai.vision_models import Image as VertexImage
from vertexai.vision_models import MultiModalEmbeddingModel

from config import settings

logger = logging.getLogger(__name__)

vertexai.init(project=settings.gcp_project_id, location=settings.gcp_location)

_model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")
DIMENSIONS = 1408


async def embed_image(image_path: Path) -> list[float]:
    """Generate a multimodal embedding for a single image via Vertex AI."""
    image = VertexImage.load_from_file(str(image_path))

    # Run sync call in thread pool to avoid blocking
    loop = _asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: _model.get_embeddings(image=image, dimension=DIMENSIONS),
    )

    embedding = response.image_embedding
    logger.info(f"Embedded {image_path.name}: {len(embedding)}-dim vector")
    return embedding


async def embed_text(text: str) -> list[float]:
    """Generate a text embedding for search queries."""
    loop = _asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: _model.get_embeddings(contextual_text=text, dimension=DIMENSIONS),
    )

    return response.text_embedding


async def embed_batch(image_paths: list[Path]) -> np.ndarray:
    """Embed multiple images, returns numpy array of shape (n, DIMENSIONS)."""
    tasks = [embed_image(p) for p in image_paths]
    embeddings = await _asyncio.gather(*tasks)

    matrix = np.array(embeddings, dtype=np.float32)
    logger.info(f"Batch embedded {len(image_paths)} images → {matrix.shape}")
    return matrix


def build_faiss_index(embeddings: np.ndarray, m: int = 32, ef_search: int = 200):
    """Build a FAISS HNSW index from embedding vectors."""
    import faiss

    dim = embeddings.shape[1]
    index = faiss.IndexHNSWFlat(dim, m)
    index.hnsw.efSearch = ef_search
    index.add(embeddings)

    logger.info(f"Built FAISS index: {index.ntotal} vectors, {dim}-dim, M={m}")
    return index


def save_faiss_index(index, path: Path):
    """Save a FAISS index to disk."""
    import faiss

    path.parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(path))
    logger.info(f"Saved FAISS index to {path}")


def load_faiss_index(path: Path):
    """Load a FAISS index from disk."""
    import faiss

    return faiss.read_index(str(path))
