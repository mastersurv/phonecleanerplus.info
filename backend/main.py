"""
Phone Cleaner Plus - Stripe Payment Backend.

FastAPI application for handling Stripe payments and subscriptions.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.routers import stripe_router


# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title="Phone Cleaner Plus Payment API",
    description="Stripe payment integration for Phone Cleaner Plus subscription service",
    version="1.0.0",
    debug=settings.DEBUG,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(stripe_router.router)


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return JSONResponse(
        content={
            "status": "ok",
            "service": "Phone Cleaner Plus Payment API",
        }
    )


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return JSONResponse(
        content={
            "status": "healthy",
            "stripe_configured": bool(settings.STRIPE_SECRET_KEY),
        }
    )


@app.on_event("startup")
async def startup_event():
    """Application startup event handler."""
    logger.info("Starting Phone Cleaner Plus Payment API")
    
    # Validate configuration
    try:
        settings.validate()
        logger.info("Configuration validated successfully")
    except ValueError as e:
        logger.warning("Configuration warning: %s", str(e))


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event handler."""
    logger.info("Shutting down Phone Cleaner Plus Payment API")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )

