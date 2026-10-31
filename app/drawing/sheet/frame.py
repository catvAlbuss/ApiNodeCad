"""Marco de lámina y membrete con datos editables."""

import textwrap

from app.domain.sheet.scale import PAPER
from app.domain.wall.geometry import Point, top_y
from app.drawing.annotations import fixed
from app.drawing.primitives import Sheet
from app.standards import typography as type_size

MEMBRETE = "MEMBRETE"
WRAP_WIDTH = 50
LINE_STEP = 6


def draw_frame(paper: Sheet) -> None:
    width, height, left, margin = PAPER.width, PAPER.height, PAPER.left, PAPER.margin
    right = width - margin
    paper.poly("MARCO", [(0, 0), (width, 0), (width, height), (0, height)], closed=True)
    paper.poly(
        "MARCO",
        [(left, margin), (right, margin), (right, height - margin), (left, height - margin)],
        closed=True,
    )


def draw_title_block(block: Sheet, plan) -> None:
    height, margin = PAPER.height, PAPER.margin
    x0, x1 = PAPER.block_x, PAPER.width - margin
    block.line(MEMBRETE, Point(x0, margin), Point(x0, height - margin))
    y = height - margin

    def row(label: str, tag: str, value: str, lines: int = 1, size: float = type_size.BODY) -> None:
        nonlocal y
        wrapped = (textwrap.wrap(value, WRAP_WIDTH) or ["-"])[:lines]
        block.text(MEMBRETE, Point(x0 + 3, y - 5), type_size.BODY, label)
        for index, text in enumerate(wrapped):
            name = tag if lines == 1 else f"{tag}_{index + 1}"
            block.attribute(MEMBRETE, Point(x0 + 3, y - 11 - index * LINE_STEP), size, name, text)
        y -= 8 + len(wrapped) * LINE_STEP
        block.line(MEMBRETE, Point(x0, y), Point(x1, y))

    project = plan.project
    title = f"MURO DE CONTENCIÓN H = {fixed(top_y(plan.geo))} m - DIMENSIONES Y REFUERZO"
    row("PROYECTO:", "PROYECTO", project.proyecto, 6, type_size.SUBTITLE)
    row("CÓDIGO:", "CODIGO", project.codigo)
    row("ENTIDAD / CLIENTE:", "CLIENTE", project.cliente, 2)
    row("UBICACIÓN:", "UBICACION", project.ubicacion, 4)
    row("ESPECIALIDAD:", "ESPECIALIDAD", "ESTRUCTURAS", 1, type_size.SUBTITLE)
    row("PLANO:", "PLANO", title, 2, type_size.SUBTITLE)
    row("INGENIERO RESPONSABLE:", "INGENIERO", project.ingeniero)
    block.text(MEMBRETE, Point(x0 + 3, y - 5), type_size.BODY, "SELLO Y FIRMA:")

    body = type_size.BODY
    block.line(MEMBRETE, Point(x0, margin + 30), Point(x1, margin + 30))
    block.line(MEMBRETE, Point(x0 + 110, margin), Point(x0 + 110, margin + 30))
    block.text(MEMBRETE, Point(x0 + 3, margin + 22), body, "ESCALA:")
    block.attribute(MEMBRETE, Point(x0 + 28, margin + 22), body, "ESCALA", f"1:{block.scale}")
    block.text(MEMBRETE, Point(x0 + 3, margin + 14), body, "FECHA:")
    block.attribute(MEMBRETE, Point(x0 + 28, margin + 14), body, "FECHA", project.fecha)
    block.text(MEMBRETE, Point(x0 + 3, margin + 6), body, "UNIDADES:")
    block.attribute(MEMBRETE, Point(x0 + 28, margin + 6), body, "UNIDADES", "METROS")
    block.text(MEMBRETE, Point(x0 + 113, margin + 22), body, "LÁMINA:")
    block.attribute(
        MEMBRETE,
        Point(x0 + 140, margin + 8),
        type_size.SHEET_NUMBER,
        "LAMINA",
        project.lamina,
        "center",
    )
