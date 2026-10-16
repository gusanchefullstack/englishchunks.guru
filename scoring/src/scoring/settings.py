"""Typed configuration for the scoring service (fails fast on missing values)."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    scoring_shared_secret: str = Field(min_length=32)
    models_dir: Path = Path("./models")
    # Curated IPA hint table shared with the web app. Defaults to the repo copy; the Docker image
    # sets SOUND_HINTS_PATH explicitly.
    sound_hints_path: Path = (
        Path(__file__).resolve().parents[3] / "web" / "src" / "content" / "sound-hints.json"
    )
    max_audio_seconds: float = 15.0
    max_audio_bytes: int = 1_048_576
    signature_skew_seconds: int = 60
    # Score combination weights (research R7); tuned by the calibration suite.
    weight_phoneme: float = 0.5
    weight_word: float = 0.3
    weight_fluency: float = 0.2


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
