import json
import logging
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

from config import settings

logger = logging.getLogger(__name__)

# Vertex AI backed Gemini client
client = genai.Client(
    vertexai=True,
    project=settings.gcp_project_id,
    location=settings.gcp_location,
)

MODEL = "gemini-2.5-flash"


# ── Stage 1: Order Parsing ──────────────────────────────────────────────────

ORDER_PARSING_SCHEMA = {
    "type": "object",
    "properties": {
        "keywords": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Pexels search keywords derived from the description",
        },
        "thresholds": {
            "type": "object",
            "properties": {
                "aesthetic_min": {"type": "number"},
                "semantic_min": {"type": "number"},
                "sharpness_min": {"type": "number"},
                "motion_max": {"type": "number"},
            },
            "required": ["aesthetic_min", "semantic_min", "sharpness_min", "motion_max"],
        },
        "quality_tier": {
            "type": "string",
            "enum": ["standard", "high", "cinematic"],
        },
        "content_filters": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Content restrictions like no_logos, no_text, no_people",
        },
    },
    "required": ["keywords", "thresholds", "quality_tier", "content_filters"],
}


async def parse_order(description: str, target_minutes: int) -> dict:
    """Parse a natural language order into a structured pipeline spec."""
    prompt = f"""You are a video dataset curator. Parse the user's request into a structured specification.

User request: "{description}"
Target duration: {target_minutes} minutes

Extract:
- keywords: 4-8 search terms for Pexels video API
- thresholds: quality filter thresholds (0-1 scale)
  - aesthetic_min: visual quality minimum (default 0.5, higher for "cinematic" or "high quality")
  - semantic_min: relevance to description minimum (default 0.4)
  - sharpness_min: blur rejection threshold (default 0.1)
  - motion_max: maximum motion intensity (default 0.8, lower if "minimal shake" requested)
- quality_tier: "standard", "high", or "cinematic"
- content_filters: restrictions like "no_logos", "no_text_overlay", "no_people" based on user intent"""

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=ORDER_PARSING_SCHEMA,
            temperature=0,
        ),
    )

    result = json.loads(response.text)
    tokens = response.usage_metadata
    logger.info(f"Order parsed: {len(result['keywords'])} keywords, tier={result['quality_tier']}, "
                f"tokens={tokens.total_token_count if tokens else '?'}")
    return result


# ── Stage 3a: Sharpness/Blur Detection ──────────────────────────────────────

SHARPNESS_SCHEMA = {
    "type": "object",
    "properties": {
        "sharpness_score": {
            "type": "number",
            "description": "0.0 = extremely blurry, 1.0 = perfectly sharp",
        },
        "is_blurry": {"type": "boolean"},
    },
    "required": ["sharpness_score", "is_blurry"],
}


async def score_sharpness(frame_path: Path) -> dict:
    """Score a frame's sharpness using Gemini Flash Vision."""
    image = Image.open(frame_path)

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=[
            image,
            "Rate the sharpness of this image. 0.0 = extremely blurry/out of focus, 1.0 = perfectly sharp and clear. Consider focus, motion blur, and noise.",
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=SHARPNESS_SCHEMA,
            temperature=0,
        ),
    )

    return json.loads(response.text)


# ── Stage 3b: Quality Scoring (aesthetic + semantic + caption + motion) ─────

QUALITY_SCHEMA = {
    "type": "object",
    "properties": {
        "aesthetic_score": {
            "type": "number",
            "description": "Visual quality: composition, lighting, color. 0.0-1.0",
        },
        "semantic_score": {
            "type": "number",
            "description": "Relevance to the dataset description. 0.0-1.0",
        },
        "motion_score": {
            "type": "number",
            "description": "Movement intensity. 0.0 = static, 1.0 = intense motion",
        },
        "caption": {
            "type": "string",
            "description": "2-sentence description of the video clip content",
        },
    },
    "required": ["aesthetic_score", "semantic_score", "motion_score", "caption"],
}


async def score_quality(frame_paths: list[Path], order_description: str) -> dict:
    """Score a clip's aesthetic quality, semantic relevance, motion, and generate a caption.

    Sends multiple frames from the clip to capture motion and temporal context.
    """
    images = [Image.open(p) for p in frame_paths[:4]]

    prompt = f"""Analyze these {len(images)} frames from a video clip.

Dataset target: "{order_description}"

Score the clip on:
- aesthetic_score (0-1): visual quality — composition, lighting, color balance, professional look
- semantic_score (0-1): how well this clip matches the dataset description above
- motion_score (0-1): movement intensity across frames. 0 = completely static, 1 = intense fast motion
- caption: 2-sentence description of what's happening in the clip"""

    contents = [*images, prompt]

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=QUALITY_SCHEMA,
            temperature=0,
        ),
    )

    result = json.loads(response.text)
    logger.info(f"Quality scored: aes={result['aesthetic_score']:.2f} sem={result['semantic_score']:.2f} "
                f"mot={result['motion_score']:.2f}")
    return result
