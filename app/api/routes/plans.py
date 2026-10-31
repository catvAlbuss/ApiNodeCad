from fastapi import APIRouter, Request, Response

from app.api.schemas.wall_plan import WallPlanRequest
from app.generation import build_wall_plan, run_with_timeout

router = APIRouter(prefix="/api/v1/planos")

FILE_NAME = "plano-muro-contencion.dxf"


@router.post("/muro-contencion")
async def create_wall_plan(plan: WallPlanRequest, request: Request) -> Response:
    settings = request.app.state.settings
    content = await run_with_timeout(lambda: build_wall_plan(plan), settings.generation_timeout_seconds)
    return Response(
        content,
        media_type="application/dxf",
        headers={"Content-Disposition": f'attachment; filename="{FILE_NAME}"'},
    )
