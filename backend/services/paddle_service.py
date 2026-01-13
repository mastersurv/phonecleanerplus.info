"""
Paddle Billing service module.
Handles all Paddle-related operations for subscriptions.
"""
import hashlib
import hmac
import logging

from paddle_billing import Client, Environment, Options

from backend.config import settings


logger = logging.getLogger(__name__)


class PaddleService:
    """Service class for Paddle Billing operations."""

    def __init__(self):
        """Initialize Paddle client."""
        self._client = None

    @property
    def client(self) -> Client:
        """Lazy initialization of Paddle client."""
        if self._client is None:
            if not settings.PADDLE_API_KEY:
                raise ValueError("PADDLE_API_KEY is not configured")

            environment = (
                Environment.SANDBOX
                if settings.PADDLE_ENVIRONMENT == "sandbox"
                else Environment.PRODUCTION
            )

            self._client = Client(
                settings.PADDLE_API_KEY,
                options=Options(environment),
            )

        return self._client

    def create_customer(self, email: str, name: str | None = None) -> dict:
        """
        Create a Paddle customer.

        Args:
            email: Customer's email address.
            name: Customer's name (optional).

        Returns:
            Dict with customer data including ID.
        """
        logger.info("Creating Paddle customer for email: %s", email)

        customer_data = {"email": email}
        if name:
            customer_data["name"] = name

        customer = self.client.customers.create(**customer_data)

        logger.info("Paddle customer created: %s", customer.id)

        return {
            "id": customer.id,
            "email": customer.email,
            "name": getattr(customer, "name", None),
        }

    def create_transaction(
        self,
        price_id: str | None = None,
        customer_id: str | None = None,
        customer_email: str | None = None,
    ) -> dict:
        """
        Create a Paddle transaction for checkout.

        Args:
            price_id: Paddle Price ID (defaults to configured PADDLE_PRICE_ID).
            customer_id: Existing Paddle Customer ID (optional).
            customer_email: Customer email for new customer (optional).

        Returns:
            Dict with transaction data for frontend checkout.
        """
        price_id = price_id or settings.PADDLE_PRICE_ID

        if not price_id:
            raise ValueError("PADDLE_PRICE_ID is not configured")

        logger.info(
            "Creating Paddle transaction for price: %s, customer: %s",
            price_id,
            customer_id or customer_email,
        )

        # Build transaction data
        transaction_data = {
            "items": [
                {
                    "price_id": price_id,
                    "quantity": 1,
                }
            ],
        }

        # Add customer info if provided
        if customer_id:
            transaction_data["customer_id"] = customer_id
        elif customer_email:
            transaction_data["customer"] = {"email": customer_email}

        transaction = self.client.transactions.create(**transaction_data)

        logger.info("Paddle transaction created: %s", transaction.id)

        return {
            "transaction_id": transaction.id,
            "status": str(transaction.status),
            "customer_id": getattr(transaction, "customer_id", None),
        }

    def get_transaction(self, transaction_id: str) -> dict:
        """
        Get transaction details.

        Args:
            transaction_id: Paddle Transaction ID.

        Returns:
            Dict with transaction details.
        """
        transaction = self.client.transactions.get(transaction_id)

        return {
            "id": transaction.id,
            "status": str(transaction.status),
            "customer_id": getattr(transaction, "customer_id", None),
            "subscription_id": getattr(transaction, "subscription_id", None),
        }

    def get_subscription(self, subscription_id: str) -> dict:
        """
        Get subscription details.

        Args:
            subscription_id: Paddle Subscription ID.

        Returns:
            Dict with subscription details.
        """
        subscription = self.client.subscriptions.get(subscription_id)

        billing_period = getattr(subscription, "current_billing_period", None)

        return {
            "id": subscription.id,
            "status": str(subscription.status),
            "customer_id": getattr(subscription, "customer_id", None),
            "current_billing_period": {
                "starts_at": (
                    billing_period.starts_at.isoformat()
                    if billing_period and hasattr(billing_period, "starts_at")
                    else None
                ),
                "ends_at": (
                    billing_period.ends_at.isoformat()
                    if billing_period and hasattr(billing_period, "ends_at")
                    else None
                ),
            },
            "next_billed_at": (
                subscription.next_billed_at.isoformat()
                if hasattr(subscription, "next_billed_at")
                and subscription.next_billed_at
                else None
            ),
        }

    def cancel_subscription(
        self,
        subscription_id: str,
        effective_from: str = "next_billing_period",
    ) -> dict:
        """
        Cancel a subscription.

        Args:
            subscription_id: Paddle Subscription ID.
            effective_from: When cancellation takes effect.
                "immediately" or "next_billing_period" (default).

        Returns:
            Dict with cancelled subscription details.
        """
        logger.info("Cancelling Paddle subscription: %s", subscription_id)

        subscription = self.client.subscriptions.cancel(
            subscription_id,
            effective_from=effective_from,
        )

        logger.info(
            "Paddle subscription cancelled: %s, status: %s",
            subscription_id,
            subscription.status,
        )

        scheduled_change = getattr(subscription, "scheduled_change", None)

        return {
            "id": subscription.id,
            "status": str(subscription.status),
            "scheduled_change": (
                {
                    "action": str(scheduled_change.action),
                    "effective_at": (
                        scheduled_change.effective_at.isoformat()
                        if hasattr(scheduled_change, "effective_at")
                        and scheduled_change.effective_at
                        else None
                    ),
                }
                if scheduled_change
                else None
            ),
        }

    @staticmethod
    def verify_webhook_signature(
        payload: bytes,
        signature: str,
        timestamp: str,
        secret: str | None = None,
    ) -> bool:
        """
        Verify Paddle webhook signature.

        Paddle uses HMAC-SHA256 to sign webhooks.
        Signature format: ts=<timestamp>;h1=<signature>

        Args:
            payload: Raw request body bytes.
            signature: Paddle-Signature header value.
            timestamp: Timestamp from the signature header.
            secret: Webhook secret (defaults to settings).

        Returns:
            True if signature is valid, False otherwise.
        """
        secret = secret or settings.PADDLE_WEBHOOK_SECRET

        if not secret:
            logger.warning(
                "PADDLE_WEBHOOK_SECRET not configured, skipping verification"
            )
            return True

        # Build the signed payload
        signed_payload = f"{timestamp}:{payload.decode('utf-8')}"

        # Compute expected signature
        expected_signature = hmac.new(
            secret.encode("utf-8"),
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        # Extract h1 signature from header
        # Format: ts=<timestamp>;h1=<signature>
        try:
            sig_parts = dict(
                part.split("=", 1) for part in signature.split(";")
            )
            received_signature = sig_parts.get("h1", "")
        except (ValueError, AttributeError):
            logger.error("Invalid signature format")
            return False

        # Compare signatures
        return hmac.compare_digest(expected_signature, received_signature)

    @staticmethod
    def parse_webhook_signature(signature_header: str) -> tuple[str, str]:
        """
        Parse Paddle-Signature header.

        Args:
            signature_header: The Paddle-Signature header value.

        Returns:
            Tuple of (timestamp, signature).
        """
        parts = dict(
            part.split("=", 1) for part in signature_header.split(";")
        )
        return parts.get("ts", ""), parts.get("h1", "")


# Singleton instance
paddle_service = PaddleService()
