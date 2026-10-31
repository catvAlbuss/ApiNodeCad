import math
import time
from collections import defaultdict, deque

from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.middleware.responses import send_error


class RateLimitMiddleware:
    """Ventana deslizante en memoria por IP. Basta con una sola instancia."""

    def __init__(self, app: ASGIApp, limit: int, window_seconds: float):
        self.app, self.limit, self.window = app, limit, window_seconds
        self.hits: defaultdict[str, deque[float]] = defaultdict(deque)

    def retry_after(self, key: str, now: float) -> int | None:
        hits = self.hits[key]
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return math.ceil(hits[0] + self.window - now)
        hits.append(now)
        return None

    def forget_idle(self, now: float) -> None:
        for key in [k for k, hits in self.hits.items() if not hits or hits[-1] <= now - self.window]:
            del self.hits[key]

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith("/api/"):
            await self.app(scope, receive, send)
            return
        now = time.monotonic()
        if len(self.hits) > 10_000:
            self.forget_idle(now)
        client = scope.get("client")
        wait = self.retry_after(client[0] if client else "desconocido", now)
        if wait is not None:
            await send_error(send, 429, "RATE_LIMITED", "Demasiadas solicitudes", {"retry-after": str(wait)})
            return
        await self.app(scope, receive, send)
