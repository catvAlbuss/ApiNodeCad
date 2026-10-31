"""Formato único de error: { "error": { "code", "message", "fields" } }."""

from collections.abc import Sequence

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

HTTP_CODES = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}

# Mensajes propios: los de Pydantic pueden repetir el valor recibido.
MESSAGES = {
    "missing": "es obligatorio",
    "extra_forbidden": "no pertenece al contrato",
    "greater_than": "debe ser mayor que {gt:g}",
    "greater_than_equal": "debe ser mayor o igual que {ge:g}",
    "less_than_equal": "debe ser menor o igual que {le:g}",
    "finite_number": "debe ser un número finito",
    "float_type": "debe ser un número",
    "int_type": "debe ser un número entero",
    "string_type": "debe ser un texto",
    "string_too_short": "no puede estar vacío",
    "string_too_long": "supera la longitud máxima de {max_length}",
    "model_type": "debe ser un objeto",
    "model_attributes_type": "debe ser un objeto",
    "dict_type": "debe ser un objeto",
}


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, fields: Sequence[str] = ()):
        self.status, self.code, self.message, self.fields = status, code, message, list(fields)


def error_body(code: str, message: str, fields: Sequence[str] = ()) -> dict:
    return {"error": {"code": code, "message": message, "fields": list(fields)}}


def _field_path(location: Sequence[str | int]) -> str:
    return ".".join(str(part) for part in location if part != "body")


def _describe(error: dict) -> tuple[str, list[str]]:
    context = error.get("ctx", {})
    if "fields" in context:  # Regla entre campos, definida en el esquema
        return error["msg"], list(context["fields"])
    path = _field_path(error["loc"])
    template = MESSAGES.get(error["type"], "no es válido")
    return f"{path} {template.format(**context)}".strip(), [path]


def validation_error(exc: RequestValidationError) -> ApiError:
    errors = exc.errors()
    if any(error["type"] == "json_invalid" for error in errors):
        return ApiError(400, "VALIDATION_ERROR", "El cuerpo no es un JSON válido")
    described = [_describe(error) for error in errors]
    fields = [field for _, names in described for field in names if field]
    return ApiError(400, "VALIDATION_ERROR", described[0][0], fields)


def register_error_handlers(app: FastAPI) -> None:
    def respond(error: ApiError, headers: dict | None = None) -> JSONResponse:
        return JSONResponse(error_body(error.code, error.message, error.fields), error.status, headers)

    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        return respond(exc)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return respond(validation_error(exc))

    @app.exception_handler(HTTPException)
    async def handle_http(_: Request, exc: HTTPException) -> JSONResponse:
        code = HTTP_CODES.get(exc.status_code, "HTTP_ERROR")
        return respond(ApiError(exc.status_code, code, "Solicitud no atendida"), exc.headers)
