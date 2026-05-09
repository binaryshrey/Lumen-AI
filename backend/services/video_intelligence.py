import logging

from google.cloud import videointelligence_v1 as vi

logger = logging.getLogger(__name__)

_client = vi.VideoIntelligenceServiceClient()


def detect_explicit_content(gcs_uri: str) -> dict:
    """Run explicit content detection on a video in GCS.

    Returns {is_safe: bool, max_likelihood: str, frames: [{time_s, likelihood}]}
    """
    request = vi.AnnotateVideoRequest(
        input_uri=gcs_uri,
        features=[vi.Feature.EXPLICIT_CONTENT_DETECTION],
    )

    operation = _client.annotate_video(request=request)
    logger.info(f"Waiting for explicit content detection on {gcs_uri}...")
    result = operation.result(timeout=300)

    annotation = result.annotation_results[0].explicit_annotation

    likelihood_names = {
        vi.Likelihood.VERY_UNLIKELY: "VERY_UNLIKELY",
        vi.Likelihood.UNLIKELY: "UNLIKELY",
        vi.Likelihood.POSSIBLE: "POSSIBLE",
        vi.Likelihood.LIKELY: "LIKELY",
        vi.Likelihood.VERY_LIKELY: "VERY_LIKELY",
    }

    frames = []
    max_likelihood = vi.Likelihood.VERY_UNLIKELY

    for frame in annotation.frames:
        likelihood = frame.pornography_likelihood
        if likelihood > max_likelihood:
            max_likelihood = likelihood

        time_s = frame.time_offset.total_seconds()
        frames.append({
            "time_s": round(time_s, 2),
            "likelihood": likelihood_names.get(likelihood, "UNKNOWN"),
        })

    is_safe = max_likelihood < vi.Likelihood.LIKELY

    logger.info(f"Explicit content: is_safe={is_safe}, max={likelihood_names.get(max_likelihood)}")
    return {
        "is_safe": is_safe,
        "max_likelihood": likelihood_names.get(max_likelihood, "UNKNOWN"),
        "frames": frames,
    }


def detect_labels(gcs_uri: str) -> list[dict]:
    """Run label detection on a video in GCS.

    Returns list of [{label, confidence, category}] sorted by confidence.
    """
    request = vi.AnnotateVideoRequest(
        input_uri=gcs_uri,
        features=[vi.Feature.LABEL_DETECTION],
        video_context=vi.VideoContext(
            label_detection_config=vi.LabelDetectionConfig(
                label_detection_mode=vi.LabelDetectionMode.SHOT_AND_FRAME_MODE,
            ),
        ),
    )

    operation = _client.annotate_video(request=request)
    logger.info(f"Waiting for label detection on {gcs_uri}...")
    result = operation.result(timeout=300)

    labels = []
    for label in result.annotation_results[0].segment_label_annotations:
        top_segment = max(label.segments, key=lambda s: s.confidence)
        category = label.category_entities[0].description if label.category_entities else ""

        labels.append({
            "label": label.entity.description,
            "confidence": round(top_segment.confidence, 3),
            "category": category,
        })

    labels.sort(key=lambda x: x["confidence"], reverse=True)
    logger.info(f"Labels detected: {[l['label'] for l in labels[:5]]}")
    return labels


def detect_shots(gcs_uri: str) -> list[dict]:
    """Run shot change detection on a video in GCS.

    Returns list of [{start_s, end_s, duration_s}] for each shot.
    """
    request = vi.AnnotateVideoRequest(
        input_uri=gcs_uri,
        features=[vi.Feature.SHOT_CHANGE_DETECTION],
    )

    operation = _client.annotate_video(request=request)
    logger.info(f"Waiting for shot change detection on {gcs_uri}...")
    result = operation.result(timeout=300)

    shots = []
    for shot in result.annotation_results[0].shot_annotations:
        start = shot.start_time_offset.total_seconds()
        end = shot.end_time_offset.total_seconds()
        shots.append({
            "start_s": round(start, 2),
            "end_s": round(end, 2),
            "duration_s": round(end - start, 2),
        })

    logger.info(f"Detected {len(shots)} shots in {gcs_uri}")
    return shots


def check_label_relevance(labels: list[dict], keywords: list[str], min_match: int = 1) -> dict:
    """Check if detected labels match any of the order keywords.

    Returns {is_relevant: bool, matched_keywords: [...], matched_labels: [...]}
    """
    label_texts = {l["label"].lower() for l in labels}
    keyword_set = {k.lower() for k in keywords}

    matched = []
    for keyword in keyword_set:
        for label in label_texts:
            if keyword in label or label in keyword:
                matched.append({"keyword": keyword, "label": label})

    return {
        "is_relevant": len(matched) >= min_match,
        "matched": matched,
        "label_count": len(labels),
    }
