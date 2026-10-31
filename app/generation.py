import asyncio
from collections.abc import Callable

from starlette.concurrency import run_in_threadpool

from app.api.errors import ApiError
from app.api.schemas.wall_plan import WallPlanRequest


def build_wall_plan(plan: WallPlanRequest) -> bytes:
    # Fase 1: el contrato ya está activo; el dibujo llega en la fase 2.
    raise ApiError(501, "NOT_IMPLEMENTED", "La generación del plano aún no está disponible")


async def run_with_timeout[T](work: Callable[[], T], timeout_seconds: float) -> T:
    """Fuera del bucle de eventos y con tiempo máximo de respuesta."""
    try:
        return await asyncio.wait_for(run_in_threadpool(work), timeout_seconds)
    except TimeoutError:
        raise ApiError(500, "GENERATION_TIMEOUT", "La generación superó el tiempo máximo") from None
