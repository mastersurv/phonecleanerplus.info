# Phone Cleaner Plus - Stripe Payment Backend

FastAPI backend for handling Stripe payments and subscriptions.

## Project Structure

```
backend/
├── __init__.py
├── main.py              # FastAPI application entry point
├── config.py            # Configuration from environment variables
├── requirements.txt     # Python dependencies
├── env.example          # Example environment variables (copy to .env)
├── routers/
│   ├── __init__.py
│   └── stripe_router.py # Stripe API endpoints
└── services/
    ├── __init__.py
    └── stripe_service.py # Stripe business logic
```

## Setup

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
cp env.example .env
```

Edit `.env` with your Stripe credentials:

- `STRIPE_SECRET_KEY` - Your Stripe secret key (starts with `sk_test_` or `sk_live_`)
- `STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key (starts with `pk_test_` or `pk_live_`)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (starts with `whsec_`)
- `STRIPE_PRICE_ID` - Price ID for your subscription product (starts with `price_`)

### 3. Run the Server

```bash
# Development mode with auto-reload
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Or run directly
python -m backend.main
```

## API Endpoints

### POST `/api/stripe/create-checkout-session`
Creates a Stripe Checkout Session for hosted payment page.

**Request Body:**
```json
{
  "email": "customer@example.com"
}
```

**Response:**
```json
{
  "id": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### GET `/api/stripe/checkout`
Redirects directly to Stripe Checkout page.

**Query Parameters:**
- `email` (optional) - Customer email

### POST `/api/stripe/create-setup-intent`
Creates a SetupIntent for inline card input using Stripe Elements.

**Request Body:**
```json
{
  "email": "customer@example.com"
}
```

**Response:**
```json
{
  "clientSecret": "seti_..._secret_...",
  "customerId": "cus_...",
  "priceId": "price_..."
}
```

### POST `/api/stripe/create-subscription`
Creates a subscription after payment method is saved.

**Request Body:**
```json
{
  "customer_id": "cus_...",
  "price_id": "price_...",
  "payment_method_id": "pm_..."
}
```

**Response:**
```json
{
  "subscriptionId": "sub_...",
  "status": "trialing"
}
```

### POST `/api/stripe/webhook`
Handles Stripe webhook events. Configure this endpoint in your Stripe Dashboard.

### GET `/api/stripe/session/{session_id}`
Retrieves checkout session details.

## Stripe Dashboard Setup

### 1. Create a Product and Price

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Products
2. Click "Add product"
3. Set name: "Ultra Cleaner Monthly Subscription"
4. Add price: $29.99, Recurring monthly
5. Copy the Price ID (starts with `price_`)

### 2. Configure Trial Period

When creating the price or in the checkout session, set:
- Trial period: 3 days

### 3. Set Up Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter your endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

## Testing

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

Any future date for expiry, any 3-digit CVC, any postal code.

## Production Deployment

1. Use live Stripe keys (starts with `sk_live_` and `pk_live_`)
2. Set `DEBUG=False`
3. Update `BASE_URL` and `FRONTEND_URL` to production URLs
4. Configure webhook endpoint with production URL
5. Use HTTPS only
6. Set up proper logging and monitoring

## Running with Frontend

The backend serves API endpoints only. Run the frontend separately:

```bash
# In one terminal - start backend
cd backend
uvicorn backend.main:app --reload --port 8000

# In another terminal - serve frontend (example with Python)
cd /path/to/phonecleanerplus.info
python -m http.server 8080
```

Or configure your web server (nginx, Apache) to:
- Serve static files from the root directory
- Proxy `/api/*` requests to the FastAPI backend

