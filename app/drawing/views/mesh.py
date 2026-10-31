"""Vistas 3 a 6: paño representativo con las barras a su separación real."""

from app.domain.wall.geometry import Point
from app.domain.wall.reinforcement import spacing_m
from app.drawing.annotations import dimension, leader, shift
from app.drawing.primitives import Sheet

BAR_INSET = 0.05
LEADER_STEP = 0.2  # Posición de la referencia cuando aún no hay barras


def bar_positions(length: float, spacing: float | None) -> list[float]:
    if spacing is None:
        return []
    count = int((length - spacing / 2) / spacing) + 1
    return [spacing / 2 + i * spacing for i in range(count) if spacing / 2 + i * spacing < length]


def mesh_view(sheet: Sheet, origin: Point, width: float, height: float, vertical, horizontal) -> None:
    def at(x: float, y: float) -> Point:
        return shift(origin, Point(x, y))

    unit = sheet.unit
    sheet.poly("CONCRETO", [at(0, 0), at(width, 0), at(width, height), at(0, height)], closed=True)
    vertical_step, horizontal_step = spacing_m(vertical), spacing_m(horizontal)
    for x in bar_positions(width, vertical_step):
        sheet.line("ACERO_PRINCIPAL", at(x, BAR_INSET), at(x, height - BAR_INSET))
    for y in bar_positions(height, horizontal_step):
        sheet.line("ACERO_SECUNDARIO", at(BAR_INSET, y), at(width - BAR_INSET, y))

    dimension(sheet, at(0, 0), at(width, 0), -7)
    dimension(sheet, at(width, height), at(width, 0), 7)
    first_x = (vertical_step or LEADER_STEP) * 1.5
    first_y = (horizontal_step or LEADER_STEP) * 1.5
    leader(
        sheet,
        at(first_x, height),
        at(width * 0.25, height + 9 * unit),
        vertical.label if vertical else "-",
    )
    leader(
        sheet,
        at(width, first_y),
        at(width + 12 * unit, first_y + 8 * unit),
        horizontal.label if horizontal else "-",
    )
