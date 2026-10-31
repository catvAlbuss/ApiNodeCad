"""Marco de lámina y membrete."""

import textwrap

from app.domain.sheet.scale import PAPER
from app.domain.wall.geometry import Point, top_y
from app.drawing.annotations import fixed
from app.drawing.primitives import Sheet
from app.standards import typography as type_size

MEMBRETE = "MEMBRETE"
WRAP_WIDTH = 50


def frame_and_block(sheet: Sheet, plan) -> None:
    unit = sheet.unit

    def paper(x: float, y: float) -> Point:
        return Point(x * unit, y * unit)

    width, height, left, margin = PAPER.width, PAPER.height, PAPER.left, PAPER.margin
    x0, x1 = PAPER.block_x, width - margin
    sheet.poly("MARCO", [paper(0, 0), paper(width, 0), paper(width, height), paper(0, height)], closed=True)
    sheet.poly(
        "MARCO",
        [paper(left, margin), paper(x1, margin), paper(x1, height - margin), paper(left, height - margin)],
        closed=True,
    )
    sheet.line(MEMBRETE, paper(x0, margin), paper(x0, height - margin))

    y = height - margin

    def row(label: str, value: str, lines: int = 1, size: float = type_size.BODY) -> None:
        nonlocal y
        wrapped = (textwrap.wrap(value, WRAP_WIDTH) or ["-"])[:lines]
        sheet.text(MEMBRETE, paper(x0 + 3, y - 5), type_size.BODY, label)
        for index, text in enumerate(wrapped):
            sheet.text(MEMBRETE, paper(x0 + 3, y - 11 - index * 6), size, text)
        y -= 8 + len(wrapped) * 6
        sheet.line(MEMBRETE, paper(x0, y), paper(x1, y))

    project = plan.project
    row("PROYECTO:", project.proyecto, 6, type_size.SUBTITLE)
    row("CÓDIGO:", project.codigo)
    row("ENTIDAD / CLIENTE:", project.cliente, 2)
    row("UBICACIÓN:", project.ubicacion, 4)
    row("ESPECIALIDAD:", "ESTRUCTURAS", 1, type_size.SUBTITLE)
    row(
        "PLANO:",
        f"MURO DE CONTENCIÓN H = {fixed(top_y(plan.geo))} m - DIMENSIONES Y REFUERZO",
        2,
        type_size.SUBTITLE,
    )
    row("INGENIERO RESPONSABLE:", project.ingeniero)
    sheet.text(MEMBRETE, paper(x0 + 3, y - 5), type_size.BODY, "SELLO Y FIRMA:")

    sheet.line(MEMBRETE, paper(x0, margin + 30), paper(x1, margin + 30))
    sheet.line(MEMBRETE, paper(x0 + 110, margin), paper(x0 + 110, margin + 30))
    sheet.text(MEMBRETE, paper(x0 + 3, margin + 22), type_size.BODY, f"ESCALA: 1:{sheet.scale}")
    sheet.text(MEMBRETE, paper(x0 + 3, margin + 14), type_size.BODY, f"FECHA: {project.fecha}")
    sheet.text(MEMBRETE, paper(x0 + 3, margin + 6), type_size.BODY, "UNIDADES: METROS")
    sheet.text(MEMBRETE, paper(x0 + 113, margin + 22), type_size.BODY, "LÁMINA:")
    sheet.text(MEMBRETE, paper(x0 + 140, margin + 8), type_size.SHEET_NUMBER, project.lamina, "center")
