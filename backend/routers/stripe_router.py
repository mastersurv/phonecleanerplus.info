"""
Stripe API routes.
Handles checkout sessions, webhooks, and subscription management.
"""
import json
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, EmailStr

import stripe

from backend.config import settings
from backend.services.stripe_service import stripe_service


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stripe", tags=["stripe"])


class CreateCheckoutRequest(BaseModel):
    """Request model for creating checkout session."""

    email: EmailStr | None = None


class CreateSetupIntentRequest(BaseModel):
    """Request model for creating setup intent."""

    email: EmailStr


class CreateSubscriptionRequest(BaseModel):
    """Request model for creating subscription."""

    customer_id: str
    price_id: str
    payment_method_id: str


@router.post("/create-checkout-session")
async def create_checkout_session(request: CreateCheckoutRequest):
    """
    Create a Stripe Checkout Session for subscription.

    Returns:
        JSON with session ID and URL, or redirect to Stripe Checkout.
    """
    try:
        checkout_session = stripe_service.create_checkout_session(
            customer_email=request.email,
        )

        return JSONResponse(
            content={
                "id": checkout_session.id,
                "url": checkout_session.url,
            }
        )
    except stripe.error.StripeError as e:
        logger.error("Stripe error creating checkout session: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/checkout")
async def checkout_redirect(email: str | None = None):
    """
    Create checkout session and redirect to Stripe.

    This endpoint creates a session and immediately redirects.
    """
    try:
        checkout_session = stripe_service.create_checkout_session(
            customer_email=email,
        )

        return RedirectResponse(checkout_session.url, status_code=303)
    except stripe.error.StripeError as e:
        logger.error("Stripe error in checkout redirect: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/create-setup-intent")
async def create_setup_intent(request: CreateSetupIntentRequest):
    """
    Create a SetupIntent for inline card input.

    This is used for Stripe Elements integration where
    the card is entered directly on the page.

    Returns:
        JSON with client secret, customer ID, and price ID.
    """
    print(f"\n>>> API: create-setup-intent called with email: {request.email}")
    try:
        # Create or get customer
        customer = stripe_service.create_customer(email=request.email)

        # Create SetupIntent
        setup_intent = stripe_service.create_setup_intent(
            customer_id=customer.id
        )

        print(f"<<< SetupIntent created: {setup_intent.id}")
        print(f"    Customer: {customer.id}")

        return JSONResponse(
            content={
                "clientSecret": setup_intent.client_secret,
                "customerId": customer.id,
                "priceId": settings.STRIPE_PRICE_ID,
            }
        )
    except stripe.error.StripeError as e:
        print(f"!!! ERROR creating setup intent: {e}")
        logger.error("Stripe error creating setup intent: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/create-subscription")
async def create_subscription(request: CreateSubscriptionRequest):
    """
    Create a subscription after payment method is saved.

    This is called after confirmCardSetup succeeds.

    Returns:
        JSON with subscription details.
    """
    print(f"\n>>> API: create-subscription called")
    print(f"    customer_id: {request.customer_id}")
    print(f"    price_id: {request.price_id}")
    print(f"    payment_method_id: {request.payment_method_id}")
    try:
        subscription = stripe_service.create_subscription(
            customer_id=request.customer_id,
            price_id=request.price_id,
            payment_method_id=request.payment_method_id,
        )

        print(f"<<< Subscription created: {subscription.id}")
        print(f"    Status: {subscription.status}")

        return JSONResponse(
            content={
                "subscriptionId": subscription.id,
                "status": subscription.status,
            }
        )
    except stripe.error.StripeError as e:
        print(f"!!! ERROR creating subscription: {e}")
        logger.error("Stripe error creating subscription: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.

    This endpoint receives events from Stripe about payment status,
    subscription changes, etc.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # If webhook secret is configured, verify the signature
    if settings.STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe_service.construct_webhook_event(
                payload=payload,
                sig_header=sig_header,
            )
        except ValueError as e:
            logger.error("Invalid webhook payload: %s", str(e))
            raise HTTPException(
                status_code=400, detail="Invalid payload"
            ) from e
        except stripe.error.SignatureVerificationError as e:
            logger.error("Invalid webhook signature: %s", str(e))
            raise HTTPException(
                status_code=400, detail="Invalid signature"
            ) from e
    else:
        # Without webhook secret, just parse the event
        try:
            event = stripe.Event.construct_from(
                json.loads(payload),
                stripe.api_key,
            )
        except ValueError as e:
            logger.error("Invalid webhook payload: %s", str(e))
            raise HTTPException(
                status_code=400, detail="Invalid payload"
            ) from e

    # Print to console for immediate visibility during development
    print(f"\n{'='*50}")
    print(f"WEBHOOK RECEIVED: {event['type']}")
    print(f"{'='*50}")
    logger.info("Received webhook event: %s", event["type"])

    # Handle specific event types
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]

        customer_email = session.get("customer_details", {}).get("email")
        customer_name = session.get("customer_details", {}).get("name")
        amount_total = session.get("amount_total")
        currency = session.get("currency")
        subscription_id = session.get("subscription")

        logger.info(
            "Checkout completed: email=%s, name=%s, amount=%s %s, sub=%s",
            customer_email,
            customer_name,
            amount_total,
            currency,
            subscription_id,
        )

        # TODO: Save to database
        # TODO: Send confirmation email

    elif event["type"] == "setup_intent.succeeded":
        setup_intent = event["data"]["object"]
        print(f"  SetupIntent succeeded: {setup_intent['id']}")
        print(f"  Customer: {setup_intent.get('customer')}")
        print(f"  Payment Method: {setup_intent.get('payment_method')}")
        logger.info(
            "SetupIntent succeeded: %s, customer=%s",
            setup_intent["id"],
            setup_intent.get("customer"),
        )

    elif event["type"] == "customer.subscription.created":
        subscription = event["data"]["object"]
        print(f"  Subscription ID: {subscription['id']}")
        print(f"  Status: {subscription['status']}")
        print(f"  Customer: {subscription.get('customer')}")
        logger.info("Subscription created: %s", subscription["id"])

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        logger.info(
            "Subscription updated: %s, status=%s",
            subscription["id"],
            subscription["status"],
        )

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        logger.info("Subscription cancelled: %s", subscription["id"])

    elif event["type"] == "invoice.paid":
        invoice = event["data"]["object"]
        logger.info(
            "Invoice paid: %s, amount=%s",
            invoice["id"],
            invoice["amount_paid"],
        )

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        logger.warning(
            "Invoice payment failed: %s, customer=%s",
            invoice["id"],
            invoice.get("customer"),
        )
        # TODO: Send payment failure notification

    elif event["type"] == "payment_method.attached":
        pm = event["data"]["object"]
        print(f"  Payment method attached: {pm['id']}")
        print(f"  Type: {pm['type']}")
        print(f"  Customer: {pm.get('customer')}")
        logger.info("Payment method attached: %s", pm["id"])

    elif event["type"] == "customer.created":
        customer = event["data"]["object"]
        print(f"  Customer created: {customer['id']}")
        print(f"  Email: {customer.get('email')}")
        logger.info("Customer created: %s", customer["id"])

    else:
        # Log any unhandled event types
        print(f"  Unhandled event type: {event['type']}")

    print(f"{'='*50}\n")
    return JSONResponse(content={"received": True})


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """
    Retrieve a checkout session by ID.

    Useful for confirming payment status on the frontend.
    """
    try:
        session = stripe_service.get_session(session_id)

        customer_email = None
        if session.customer_details:
            customer_email = session.customer_details.email

        return JSONResponse(
            content={
                "id": session.id,
                "status": session.status,
                "payment_status": session.payment_status,
                "customer_email": customer_email,
            }
        )
    except stripe.error.StripeError as e:
        logger.error("Stripe error getting session: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e
