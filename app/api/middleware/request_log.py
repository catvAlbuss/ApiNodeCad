import json
import logging
import time
import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.middleware.responses import send_error

logger = logging.getLogger("app.requests")


class RequestLogMiddleware:
    """Registra identificador, ruta, estado y duración; nunca cabeceras ni cuerpo.

    Es la capa externa: captura los errores no previstos para que el detalle
    no llegue al cliente ni, con sus datos, a los registros.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex
        started = time.perf_counter()
        status = 500
        response_started = False
        error_type = None

        async def send_with_id(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                status, response_started = message["status"], True
                message.setdefault("headers", []).append((b"x-request-id", request_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception as exc:
            error_type = type(exc).__name__
            if not response_started:
                await send_error(send_with_id, 500, "INTERNAL_ERROR", "Error interno del servidor")
        finally:
            entry = {
                "request_id": request_id,
                "method": scope["method"],
                "path": scope["path"],
                "status": status,
                "duration_ms": round((time.perf_counter() - started) * 1000, 1),
            }
            if error_type:
                entry["error_type"] = error_type
            logger.info(json.dumps(entry))
