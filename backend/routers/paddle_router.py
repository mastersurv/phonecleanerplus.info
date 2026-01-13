"""
Paddle API routes.
Handles checkout transactions, webhooks, and subscription management.
"""
import json
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

from backend.config import settings
from backend.services.paddle_service import paddle_service


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/paddle", tags=["paddle"])


class CreateTransactionRequest(BaseModel):
    """Request model for creating a transaction."""

    email: EmailStr | None = None
    customer_id: str | None = None


class CancelSubscriptionRequest(BaseModel):
    """Request model for cancelling a subscription."""

    effective_from: str = "next_billing_period"


@router.get("/config")
async def get_paddle_config():
    """
    Get Paddle client configuration for frontend.

    Returns:
        JSON with client token, price ID, and environment.
    """
    if not settings.PADDLE_CLIENT_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="Paddle is not configured",
        )

    return JSONResponse(
        content={
            "clientToken": settings.PADDLE_CLIENT_TOKEN,
            "priceId": settings.PADDLE_PRICE_ID,
            "environment": settings.PADDLE_ENVIRONMENT,
        }
    )


@router.post("/create-transaction")
async def create_transaction(request: CreateTransactionRequest):
    """
    Create a Paddle transaction for inline checkout.

    This creates a transaction that can be used with Paddle.js
    to display the inline checkout form.

    Returns:
        JSON with transaction ID and details.
    """
    print("\n>>> API: paddle/create-transaction called")
    print(f"    email: {request.email}")
    print(f"    customer_id: {request.customer_id}")

    try:
        transaction = paddle_service.create_transaction(
            customer_id=request.customer_id,
            customer_email=request.email,
        )

        print(f"<<< Transaction created: {transaction['transaction_id']}")

        return JSONResponse(content=transaction)

    except ValueError as e:
        print(f"!!! ERROR: {e}")
        logger.error("Configuration error: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        print(f"!!! ERROR creating transaction: {e}")
        logger.error("Paddle error creating transaction: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/subscription/{subscription_id}")
async def get_subscription(subscription_id: str):
    """
    Get subscription details.

    Args:
        subscription_id: Paddle Subscription ID.

    Returns:
        JSON with subscription details.
    """
    try:
        subscription = paddle_service.get_subscription(subscription_id)
        return JSONResponse(content=subscription)
    except Exception as e:
        logger.error("Paddle error getting subscription: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/subscription/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: str,
    request: CancelSubscriptionRequest,
):
    """
    Cancel a subscription.

    Args:
        subscription_id: Paddle Subscription ID.
        request: Contains effective_from setting.

    Returns:
        JSON with cancelled subscription details.
    """
    print(f"\n>>> API: paddle/subscription/{subscription_id}/cancel called")
    print(f"    effective_from: {request.effective_from}")

    try:
        subscription = paddle_service.cancel_subscription(
            subscription_id=subscription_id,
            effective_from=request.effective_from,
        )

        print(f"<<< Subscription cancelled: {subscription['id']}")

        return JSONResponse(content=subscription)
    except Exception as e:
        print(f"!!! ERROR cancelling subscription: {e}")
        logger.error("Paddle error cancelling subscription: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/webhook")
async def paddle_webhook(request: Request):
    """
    Handle Paddle webhook events.

    This endpoint receives events from Paddle about transactions,
    subscriptions, and other payment-related events.
    """
    payload = await request.body()
    signature_header = request.headers.get("paddle-signature", "")

    # Verify webhook signature if secret is configured
    if settings.PADDLE_WEBHOOK_SECRET:
        try:
            timestamp, signature = paddle_service.parse_webhook_signature(
                signature_header
            )

            if not paddle_service.verify_webhook_signature(
                payload=payload,
                signature=signature_header,
                timestamp=timestamp,
            ):
                logger.error("Invalid Paddle webhook signature")
                raise HTTPException(
                    status_code=400,
                    detail="Invalid signature",
                )
        except ValueError as e:
            logger.error("Invalid webhook signature format: %s", str(e))
            raise HTTPException(
                status_code=400,
                detail="Invalid signature format",
            ) from e

    # Parse the webhook payload
    try:
        event = json.loads(payload)
    except json.JSONDecodeError as e:
        logger.error("Invalid webhook JSON: %s", str(e))
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON payload",
        ) from e

    event_type = event.get("event_type", "unknown")
    data = event.get("data", {})

    # Print to console for immediate visibility during development
    print(f"\n{'='*50}")
    print(f"PADDLE WEBHOOK RECEIVED: {event_type}")
    print(f"{'='*50}")
    logger.info("Received Paddle webhook event: %s", event_type)

    # Handle specific event types
    if event_type == "transaction.completed":
        transaction_id = data.get("id")
        customer_id = data.get("customer_id")
        subscription_id = data.get("subscription_id")
        status = data.get("status")

        print(f"  Transaction completed: {transaction_id}")
        print(f"  Customer: {customer_id}")
        print(f"  Subscription: {subscription_id}")
        print(f"  Status: {status}")

        logger.info(
            "Transaction completed: %s, customer=%s, subscription=%s",
            transaction_id,
            customer_id,
            subscription_id,
        )

        # TODO: Save to database
        # TODO: Send confirmation email

    elif event_type == "subscription.created":
        subscription_id = data.get("id")
        customer_id = data.get("customer_id")
        status = data.get("status")

        print(f"  Subscription created: {subscription_id}")
        print(f"  Customer: {customer_id}")
        print(f"  Status: {status}")

        logger.info(
            "Subscription created: %s, customer=%s, status=%s",
            subscription_id,
            customer_id,
            status,
        )

    elif event_type == "subscription.activated":
        subscription_id = data.get("id")
        customer_id = data.get("customer_id")

        print(f"  Subscription activated: {subscription_id}")
        print(f"  Customer: {customer_id}")

        logger.info(
            "Subscription activated: %s, customer=%s",
            subscription_id,
            customer_id,
        )

    elif event_type == "subscription.updated":
        subscription_id = data.get("id")
        status = data.get("status")

        print(f"  Subscription updated: {subscription_id}")
        print(f"  Status: {status}")

        logger.info(
            "Subscription updated: %s, status=%s",
            subscription_id,
            status,
        )

    elif event_type == "subscription.canceled":
        subscription_id = data.get("id")
        customer_id = data.get("customer_id")

        print(f"  Subscription cancelled: {subscription_id}")
        print(f"  Customer: {customer_id}")

        logger.info(
            "Subscription cancelled: %s, customer=%s",
            subscription_id,
            customer_id,
        )

    elif event_type == "subscription.paused":
        subscription_id = data.get("id")

        print(f"  Subscription paused: {subscription_id}")
        logger.info("Subscription paused: %s", subscription_id)

    elif event_type == "subscription.resumed":
        subscription_id = data.get("id")

        print(f"  Subscription resumed: {subscription_id}")
        logger.info("Subscription resumed: %s", subscription_id)

    elif event_type == "transaction.payment_failed":
        transaction_id = data.get("id")
        customer_id = data.get("customer_id")

        print(f"  Payment failed: {transaction_id}")
        print(f"  Customer: {customer_id}")

        logger.warning(
            "Payment failed: transaction=%s, customer=%s",
            transaction_id,
            customer_id,
        )

        # TODO: Send payment failure notification

    elif event_type == "customer.created":
        customer_id = data.get("id")
        email = data.get("email")

        print(f"  Customer created: {customer_id}")
        print(f"  Email: {email}")

        logger.info("Customer created: %s, email=%s", customer_id, email)

    else:
        # Log any unhandled event types
        print(f"  Unhandled event type: {event_type}")
        logger.info("Unhandled Paddle event type: %s", event_type)

    print(f"{'='*50}\n")

    return JSONResponse(content={"received": True})
