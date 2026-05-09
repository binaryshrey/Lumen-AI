from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_db_url: str
    gcp_project_id: str
    gcp_location: str = "us-central1"
    google_application_credentials: str = ""
    pexels_api_key: str
    gcs_bucket: str = "lumenai-data"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
