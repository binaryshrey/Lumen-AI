import logging
from pathlib import Path

from google.cloud import vision

logger = logging.getLogger(__name__)

_client = vision.ImageAnnotatorClient()


def detect_logos(image_path: Path) -> list[str]:
    """Detect brand logos in an image. Returns list of logo descriptions."""
    content = image_path.read_bytes()
    image = vision.Image(content=content)

    response = _client.logo_detection(image=image)
    logos = [logo.description for logo in response.logo_annotations]

    if logos:
        logger.info(f"Logos detected in {image_path.name}: {logos}")
    return logos


def detect_text(image_path: Path) -> list[dict]:
    """Detect text/watermarks in an image. Returns list of text annotations with bounding info."""
    content = image_path.read_bytes()
    image = vision.Image(content=content)

    response = _client.text_detection(image=image)
    annotations = []

    for text in response.text_annotations[1:]:  # skip first (full text block)
        vertices = text.bounding_poly.vertices
        width = abs(vertices[1].x - vertices[0].x) if len(vertices) >= 2 else 0
        height = abs(vertices[2].y - vertices[1].y) if len(vertices) >= 3 else 0

        annotations.append({
            "text": text.description,
            "width": width,
            "height": height,
        })

    return annotations


def has_watermark(image_path: Path, min_text_area_ratio: float = 0.05) -> bool:
    """Check if an image has a large text overlay or watermark.

    Returns True if detected text covers more than min_text_area_ratio of the image.
    """
    from PIL import Image as PILImage
    img = PILImage.open(image_path)
    img_area = img.width * img.height

    texts = detect_text(image_path)
    if not texts:
        return False

    total_text_area = sum(t["width"] * t["height"] for t in texts)
    ratio = total_text_area / img_area if img_area > 0 else 0

    if ratio > min_text_area_ratio:
        logger.info(f"Watermark detected in {image_path.name}: text covers {ratio:.1%} of image")
        return True

    return False


def analyze_frame(image_path: Path) -> dict:
    """Run all Cloud Vision gates on a single frame. Returns gate results."""
    logos = detect_logos(image_path)
    watermark = has_watermark(image_path)

    return {
        "has_logo": len(logos) > 0,
        "logos": logos,
        "has_watermark": watermark,
    }
