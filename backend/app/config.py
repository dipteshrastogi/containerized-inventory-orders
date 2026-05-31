from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://inventory_user:inventory_password@db:5432/inventory_db"
    frontend_origin: str = "http://localhost:3000"
    app_name: str = "Inventory & Order Management API"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
