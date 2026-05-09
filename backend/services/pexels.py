import asyncio
import logging
from pathlib import Path

import httpx

from config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.pexels.com/videos"
RATE_LIMIT_DELAY = 0.5  # seconds between requests to respect 200 req/hr


class PexelsClient:
    def __init__(self):
        self.headers = {"Authorization": settings.pexels_api_key}

    async def search_videos(
        self,
        keywords: list[str],
        per_page: int = 15,
        max_pages: int = 3,
        orientation: str = "landscape",
        size: str = "medium",
    ) -> list[dict]:
        """Search Pexels for videos matching keywords. Returns deduplicated clip metadata."""
        all_clips: list[dict] = []
        seen_ids: set[str] = set()

        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            for keyword in keywords:
                for page in range(1, max_pages + 1):
                    params = {
                        "query": keyword,
                        "per_page": per_page,
                        "page": page,
                        "orientation": orientation,
                        "size": size,
                    }

                    try:
                        resp = await client.get(f"{BASE_URL}/search", params=params)
                        resp.raise_for_status()
                        data = resp.json()
                    except httpx.HTTPError as e:
                        logger.warning(f"Pexels API error for '{keyword}' page {page}: {e}")
                        break

                    videos = data.get("videos", [])
                    if not videos:
                        break

                    for video in videos:
                        pexels_id = str(video["id"])
                        if pexels_id in seen_ids:
                            continue
                        seen_ids.add(pexels_id)

                        # Pick the best HD video file
                        download_url = _pick_best_file(video.get("video_files", []))
                        if not download_url:
                            continue

                        all_clips.append({
                            "pexels_id": pexels_id,
                            "pexels_url": video.get("url", ""),
                            "download_url": download_url,
                            "duration_s": video.get("duration", 0),
                            "width": video.get("width", 0),
                            "height": video.get("height", 0),
                            "image_preview": video.get("image", ""),
                        })

                    # Respect rate limits
                    await asyncio.sleep(RATE_LIMIT_DELAY)

                    # Stop if no more pages
                    if not data.get("next_page"):
                        break

        logger.info(f"Pexels: fetched {len(all_clips)} clips for keywords {keywords}")
        return all_clips

    async def download_clip(
        self,
        download_url: str,
        dest_path: Path,
    ) -> Path:
        """Download a single video clip to dest_path."""
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("GET", download_url) as resp:
                resp.raise_for_status()
                with open(dest_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=8192):
                        f.write(chunk)

        logger.info(f"Downloaded clip to {dest_path}")
        return dest_path


def _pick_best_file(video_files: list[dict]) -> str | None:
    """Pick the best quality HD file (prefer 1920w or 1280w, avoid 4K to save bandwidth)."""
    ranked = sorted(
        [f for f in video_files if f.get("link")],
        key=lambda f: f.get("width", 0),
        reverse=True,
    )

    # Prefer Full HD (1920) or HD (1280), skip 4K
    for f in ranked:
        w = f.get("width", 0)
        if 1080 <= w <= 1920:
            return f["link"]

    # Fallback to largest available
    return ranked[0]["link"] if ranked else None


# Singleton
pexels_client = PexelsClient()
