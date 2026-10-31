from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración por entorno. Sin API_TOKEN el servicio no arranca."""

    model_config = SettingsConfigDict(env_file=".env.python", extra="ignore")

    api_token: str = Field(min_length=32)
    cors_origins: Annotated[list[str], NoDecode] = ["https://ryaie.com"]
    max_body_bytes: int = Field(default=256 * 1024, gt=0)
    rate_limit_requests: int = Field(default=30, gt=0)
    rate_limit_window_seconds: float = Field(default=60, gt=0)
    generation_timeout_seconds: float = Field(default=30, gt=0)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value
