import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.errors import register_error_handlers
from app.api.middleware.auth import TokenAuthMiddleware
from app.api.middleware.body_limit import BodyLimitMiddleware
from app.api.middleware.rate_limit import RateLimitMiddleware
from app.api.middleware.request_log import RequestLogMiddleware
from app.api.routes import health, plans
from app.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    # Sin documentación pública: el repositorio y la API son visibles desde internet.
    app = FastAPI(title="API CAD", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(plans.router)

    # El último añadido es la capa más externa.
    app.add_middleware(BodyLimitMiddleware, max_bytes=settings.max_body_bytes)
    app.add_middleware(TokenAuthMiddleware, token=settings.api_token)
    app.add_middleware(
        RateLimitMiddleware,
        limit=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.add_middleware(RequestLogMiddleware)
    return app
