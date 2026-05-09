import asyncio
import logging
import subprocess
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)


async def download_clip(url: str, dest: Path) -> Path:
    """Download a video clip from URL to local path."""
    dest.parent.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with open(dest, "wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size=8192):
                    f.write(chunk)

    logger.info(f"Downloaded clip ({dest.stat().st_size // 1024}KB) → {dest}")
    return dest


def extract_frames(video_path: Path, output_dir: Path, fps: int = 1) -> list[Path]:
    """Extract frames from a video at the given fps using FFmpeg.

    Returns sorted list of extracted frame paths.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    pattern = output_dir / "frame_%04d.jpg"

    cmd = [
        "ffmpeg",
        "-i", str(video_path),
        "-vf", f"fps={fps}",
        "-q:v", "2",  # high quality JPEG
        "-y",  # overwrite
        str(pattern),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error(f"FFmpeg error: {result.stderr[:500]}")
        return []

    frames = sorted(output_dir.glob("frame_*.jpg"))
    logger.info(f"Extracted {len(frames)} frames from {video_path.name}")
    return frames


def sample_frames(frames: list[Path], n: int = 4) -> list[Path]:
    """Pick n evenly spaced frames from a list (first, middle samples, last)."""
    if len(frames) <= n:
        return frames
    step = (len(frames) - 1) / (n - 1)
    indices = [round(i * step) for i in range(n)]
    return [frames[i] for i in indices]
