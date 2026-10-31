from starlette.datastructures import Headers
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.middleware.responses import send_error

TOO_LARGE = (413, "PAYLOAD_TOO_LARGE", "El cuerpo supera el tamaño permitido")


class BodyLimitMiddleware:
    """Lee el cuerpo con límite antes de entregarlo; cubre envíos sin Content-Length."""

    def __init__(self, app: ASGIApp, max_bytes: int):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] != "POST":
            await self.app(scope, receive, send)
            return

        declared = Headers(scope=scope).get("content-length", "0")
        if declared.isdigit() and int(declared) > self.max_bytes:
            await send_error(send, *TOO_LARGE)
            return

        chunks: list[bytes] = []
        size = 0
        more = True
        while more:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > self.max_bytes:
                await send_error(send, *TOO_LARGE)
                return
            chunks.append(chunk)
            more = message.get("more_body", False)

        delivered = False

        async def replay() -> Message:
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": b"".join(chunks), "more_body": False}

        await self.app(scope, replay, send)
