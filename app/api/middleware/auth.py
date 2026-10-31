import hmac

from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.middleware.responses import send_error


class TokenAuthMiddleware:
    """Token de servicio para /api/. Quien lo envía es Laravel, nunca el navegador."""

    def __init__(self, app: ASGIApp, token: str):
        self.app = app
        self.expected = f"Bearer {token}".encode()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith("/api/"):
            await self.app(scope, receive, send)
            return
        received = Headers(scope=scope).get("authorization", "").encode()
        if not hmac.compare_digest(received, self.expected):
            await send_error(
                send, 401, "UNAUTHORIZED", "Token inválido o ausente", {"www-authenticate": "Bearer"}
            )
            return
        await self.app(scope, receive, send)
