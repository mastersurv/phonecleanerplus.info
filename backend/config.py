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

    # Paddle configuration
    PADDLE_API_KEY: str = os.getenv("PADDLE_API_KEY", "")
    PADDLE_CLIENT_TOKEN: str = os.getenv("PADDLE_CLIENT_TOKEN", "")
    PADDLE_WEBHOOK_SECRET: str = os.getenv("PADDLE_WEBHOOK_SECRET", "")
    PADDLE_PRICE_ID: str = os.getenv("PADDLE_PRICE_ID", "")
    PADDLE_ENVIRONMENT: str = os.getenv("PADDLE_ENVIRONMENT", "sandbox")

    # Application configuration
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8080")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # Trial period days
    TRIAL_PERIOD_DAYS: int = int(os.getenv("TRIAL_PERIOD_DAYS", "3"))

    @classmethod
    def validate(cls) -> None:
        """Validate that required settings are present."""
        # Check if at least one payment provider is configured
        stripe_configured = bool(cls.STRIPE_SECRET_KEY and cls.STRIPE_PRICE_ID)
        paddle_configured = bool(cls.PADDLE_API_KEY and cls.PADDLE_PRICE_ID)

        if not stripe_configured and not paddle_configured:
            raise ValueError(
                "At least one payment provider must be configured. "
                "Set STRIPE_SECRET_KEY + STRIPE_PRICE_ID or "
                "PADDLE_API_KEY + PADDLE_PRICE_ID"
            )


settings = Settings()
