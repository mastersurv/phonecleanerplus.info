# Deploy with Docker Compose on FastPanel

This setup runs:
- **web**: nginx (serves `/frontend` + proxies `/api/*` to backend)
- **api**: FastAPI (uvicorn) on internal Docker network

FastPanel should terminate TLS (Let's Encrypt) and reverse-proxy your domain to `http://127.0.0.1:8080`.

## 1) Create backend env file on the server

Create `/var/www/.../phonecleanerplus.info/backend/.env` (same folder as `backend/requirements.txt`):

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

BASE_URL=https://phonecleanerplus.info
FRONTEND_URL=https://phonecleanerplus.info
TRIAL_PERIOD_DAYS=3
DEBUG=False
```

## 2) Build and start

From the repo root (where `docker-compose.yml` is):

```
docker compose up -d --build
docker compose ps
```

## 3) FastPanel: reverse proxy

In FastPanel UI for domain `phonecleanerplus.info`:
- Enable **SSL** (Let's Encrypt)
- Configure reverse proxy to:
  - **Upstream**: `http://127.0.0.1:8080`

After that, your site is served by the `web` container.

## 4) Stripe webhook URL

Stripe Dashboard → Developers → Webhooks:
- Endpoint URL: `https://phonecleanerplus.info/api/stripe/webhook`

Copy signing secret to `STRIPE_WEBHOOK_SECRET` in `backend/.env` and restart:

```
docker compose restart api
```

## 5) Apple Pay domain verification

Stripe will provide a file named:
`apple-developer-merchantid-domain-association`

Place it into:
`frontend/.well-known/apple-developer-merchantid-domain-association`

Then verify in Stripe Dashboard. Check from browser:

```
curl -I https://phonecleanerplus.info/.well-known/apple-developer-merchantid-domain-association
```


