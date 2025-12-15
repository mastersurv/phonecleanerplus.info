"""
Stripe service module.
Handles all Stripe-related operations.
"""
import logging

import stripe

from backend.config import settings


logger = logging.getLogger(__name__)

# Initialize Stripe with the secret key
stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    """Service class for Stripe operations."""

    @staticmethod
    def create_checkout_session(
        customer_email: str | None = None,
        price_id: str | None = None,
        trial_period_days: int | None = None,
    ) -> stripe.checkout.Session:
        """
        Create a Stripe Checkout Session for subscription.

        Args:
            customer_email: Customer's email address (optional).
            price_id: Stripe Price ID for the subscription.
            trial_period_days: Number of trial days before charging.

        Returns:
            Stripe Checkout Session object.
        """
        price_id = price_id or settings.STRIPE_PRICE_ID
        trial_period_days = trial_period_days or settings.TRIAL_PERIOD_DAYS

        success_url = (
            f"{settings.FRONTEND_URL}/welcome.html"
            f"?session_id={{CHECKOUT_SESSION_ID}}"
        )
        cancel_url = f"{settings.FRONTEND_URL}/payment.html?status=canceled"

        session_params = {
            "mode": "subscription",
            "line_items": [
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            "subscription_data": {
                "trial_period_days": trial_period_days,
            },
            "success_url": success_url,
            "cancel_url": cancel_url,
        }

        if customer_email:
            session_params["customer_email"] = customer_email

        logger.info("Creating checkout session for email: %s", customer_email)

        checkout_session = stripe.checkout.Session.create(**session_params)

        logger.info("Checkout session created: %s", checkout_session.id)

        return checkout_session

    @staticmethod
    def create_customer(email: str) -> stripe.Customer:
        """
        Create a Stripe Customer.

        Args:
            email: Customer's email address.

        Returns:
            Stripe Customer object.
        """
        logger.info("Creating Stripe customer for email: %s", email)

        customer = stripe.Customer.create(email=email)

        logger.info("Customer created: %s", customer.id)

        return customer

    @staticmethod
    def create_setup_intent(customer_id: str) -> stripe.SetupIntent:
        """
        Create a SetupIntent for saving payment method.

        Args:
            customer_id: Stripe Customer ID.

        Returns:
            Stripe SetupIntent object.
        """
        logger.info("Creating setup intent for customer: %s", customer_id)

        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
        )

        logger.info("SetupIntent created: %s", setup_intent.id)

        return setup_intent

    @staticmethod
    def create_subscription(
        customer_id: str,
        price_id: str,
        payment_method_id: str,
        trial_period_days: int | None = None,
    ) -> stripe.Subscription:
        """
        Create a subscription with a saved payment method.

        Args:
            customer_id: Stripe Customer ID.
            price_id: Stripe Price ID.
            payment_method_id: Stripe PaymentMethod ID.
            trial_period_days: Number of trial days.

        Returns:
            Stripe Subscription object.
        """
        trial_period_days = trial_period_days or settings.TRIAL_PERIOD_DAYS

        # Attach payment method to customer (if not already attached)
        try:
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id,
            )
            logger.info("Payment method %s attached to customer %s",
                        payment_method_id, customer_id)
        except stripe.error.InvalidRequestError as e:
            # Payment method might already be attached
            if "already been attached" not in str(e):
                raise
            logger.info("Payment method %s already attached", payment_method_id)

        # Set as default payment method
        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": payment_method_id},
        )

        logger.info(
            "Creating subscription for customer: %s with price: %s",
            customer_id,
            price_id,
        )

        subscription = stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
            trial_period_days=trial_period_days,
            expand=["latest_invoice.payment_intent"],
        )

        logger.info("Subscription created: %s", subscription.id)

        return subscription

    @staticmethod
    def construct_webhook_event(
        payload: bytes,
        sig_header: str,
    ) -> stripe.Event:
        """
        Construct and verify a webhook event.

        Args:
            payload: Raw request body.
            sig_header: Stripe-Signature header value.

        Returns:
            Verified Stripe Event object.
        """
        return stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.STRIPE_WEBHOOK_SECRET,
        )

    @staticmethod
    def cancel_subscription(subscription_id: str) -> stripe.Subscription:
        """
        Cancel a subscription.

        Args:
            subscription_id: Stripe Subscription ID.

        Returns:
            Cancelled Stripe Subscription object.
        """
        logger.info("Cancelling subscription: %s", subscription_id)

        subscription = stripe.Subscription.delete(subscription_id)

        logger.info("Subscription cancelled: %s", subscription_id)

        return subscription

    @staticmethod
    def get_session(session_id: str) -> stripe.checkout.Session:
        """
        Retrieve a Checkout Session by ID.

        Args:
            session_id: Stripe Checkout Session ID.

        Returns:
            Stripe Checkout Session object.
        """
        return stripe.checkout.Session.retrieve(session_id)


stripe_service = StripeService()
