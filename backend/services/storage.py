import logging
from datetime import timedelta
from pathlib import Path

from google.cloud import storage

from config import settings

logger = logging.getLogger(__name__)

_client = storage.Client()
_bucket = _client.bucket(settings.gcs_bucket)


def upload_file(local_path: Path, gcs_path: str) -> str:
    """Upload a local file to GCS. Returns gs:// URI."""
    blob = _bucket.blob(gcs_path)
    blob.upload_from_filename(str(local_path))
    uri = f"gs://{settings.gcs_bucket}/{gcs_path}"
    logger.info(f"Uploaded {local_path.name} → {uri}")
    return uri


def upload_bytes(data: bytes, gcs_path: str, content_type: str = "application/json") -> str:
    """Upload raw bytes to GCS. Returns gs:// URI."""
    blob = _bucket.blob(gcs_path)
    blob.upload_from_string(data, content_type=content_type)
    return f"gs://{settings.gcs_bucket}/{gcs_path}"


def generate_signed_url(gcs_path: str, expiration_minutes: int = 60) -> str:
    """Generate a signed download URL for a GCS object."""
    blob = _bucket.blob(gcs_path)
    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=expiration_minutes),
        method="GET",
    )
    return url


def download_file(gcs_path: str, local_path: Path) -> Path:
    """Download a GCS object to a local file."""
    local_path.parent.mkdir(parents=True, exist_ok=True)
    blob = _bucket.blob(gcs_path)
    blob.download_to_filename(str(local_path))
    logger.info(f"Downloaded gs://{settings.gcs_bucket}/{gcs_path} → {local_path}")
    return local_path


def file_exists(gcs_path: str) -> bool:
    """Check if a file exists in GCS."""
    return _bucket.blob(gcs_path).exists()
