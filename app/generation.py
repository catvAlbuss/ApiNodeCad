import asyncio
from collections.abc import Callable

from starlette.concurrency import run_in_threadpool

from app.api.errors import ApiError
from app.api.schemas.wall_plan import WallPlanRequest
from app.domain.sheet.scale import SCALES, PlanDoesNotFit
from app.drawing.sheet.layout import build_plan
from app.render.dxf_writer import render_dxf
from app.render.svg_writer import render_svg


def build_wall_plan(plan: WallPlanRequest, render: Callable = render_dxf) -> bytes:
    try:
        return render(build_plan(plan))
    except PlanDoesNotFit:
        message = f"El muro no entra en la lámina A1 a escala 1:{SCALES[-1]}"
        raise ApiError(400, "VALIDATION_ERROR", message, ["geo"]) from None


def build_wall_preview(plan: WallPlanRequest) -> bytes:
    return build_wall_plan(plan, render_svg)


async def run_with_timeout[T](work: Callable[[], T], timeout_seconds: float) -> T:
    """Fuera del bucle de eventos y con tiempo máximo de respuesta."""
    try:
        return await asyncio.wait_for(run_in_threadpool(work), timeout_seconds)
    except TimeoutError:
        raise ApiError(500, "GENERATION_TIMEOUT", "La generación superó el tiempo máximo") from None
