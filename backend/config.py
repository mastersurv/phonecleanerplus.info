"""
Configuration module for the application.
Loads environment variables and provides settings.
"""
import os

from dotenv import load_dotenv
from pathlib import Path


# Load environment variables from .env file
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    """Application settings loaded from environment variables."""

    # Stripe configuration
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PRICE_ID: str = os.getenv("STRIPE_PRICE_ID", "")

    # Application configuration
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8080")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # Trial period days
    TRIAL_PERIOD_DAYS: int = int(os.getenv("TRIAL_PERIOD_DAYS", "3"))

    @classmethod
    def validate(cls) -> None:
        """Validate that required settings are present."""
        if not cls.STRIPE_SECRET_KEY:
            raise ValueError(
                "STRIPE_SECRET_KEY environment variable is required"
            )
        if not cls.STRIPE_PRICE_ID:
            raise ValueError(
                "STRIPE_PRICE_ID environment variable is required"
            )


settings = Settings()
