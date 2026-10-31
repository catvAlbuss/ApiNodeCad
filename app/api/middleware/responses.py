import json

from starlette.types import Send

from app.api.errors import error_body


async def send_error(
    send: Send, status: int, code: str, message: str, headers: dict[str, str] | None = None
) -> None:
    body = json.dumps(error_body(code, message), ensure_ascii=False).encode()
    raw = {"content-type": "application/json", "content-length": str(len(body)), **(headers or {})}
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(name.encode(), value.encode()) for name, value in raw.items()],
        }
    )
    await send({"type": "http.response.body", "body": body})
