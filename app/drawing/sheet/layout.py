"""Composición de la lámina A1: secciones arriba, mallas abajo y cuadros a la derecha."""

from app.domain.sheet.scale import (
    CONTENT_LEFT,
    CONTENT_TOP,
    MESH_LEFT,
    PANEL_WIDTH,
    PAPER,
    SECTION_MARGIN,
    choose_scale,
    mesh_step,
    section_width,
    to_paper,
)
from app.domain.wall.geometry import Point, top_y
from app.domain.wall.reinforcement import steel_row
from app.drawing.annotations import view_title
from app.drawing.primitives import Plan, Sheet
from app.drawing.sheet.frame import draw_frame, draw_title_block
from app.drawing.sheet.tables import COLUMNS, tables_and_notes
from app.drawing.views.mesh import mesh_view
from app.drawing.views.section import geometry_view, reinforcement_view


def build_plan(plan) -> Plan:
    geo, steel = plan.geo, plan.steel
    scale = choose_scale(geo)
    sheet = Sheet(scale)
    paper = Sheet(scale, paper=True)
    title_block = Sheet(scale, paper=True)
    unit = sheet.unit
    base = geo.base

    def mm(meters: float) -> float:
        return to_paper(meters, scale)

    draw_frame(paper)
    draw_title_block(title_block, plan)

    # Fila superior: secciones
    section_w = section_width(base, scale)
    base_y = CONTENT_TOP - mm(top_y(geo) + geo.rise)
    section_x = CONTENT_LEFT + 45 + mm(SECTION_MARGIN)
    first = Point(section_x * unit, base_y * unit)
    second = Point((section_x + section_w) * unit, base_y * unit)
    geometry_view(sheet, first, geo)
    reinforcement_view(sheet, second, plan)
    title_y = (base_y - mm(geo.keyDepth) - 42) * unit
    view_title(sheet, Point(first.x, title_y), 1, "SECCIÓN TÍPICA - DIMENSIONES")
    view_title(sheet, Point(second.x, title_y), 2, "SECCIÓN TÍPICA - REFUERZO")

    # Columna de cuadros
    table_x = PAPER.block_x - sum(COLUMNS) - 4
    tables_and_notes(paper, Point(table_x, CONTENT_TOP + 5), plan)

    # Fila inferior: mallas
    panel = min(PANEL_WIDTH, base)
    stem = geo.stem
    row_bottom = PAPER.margin + 28
    row_top = base_y - mm(geo.keyDepth) - 44
    mesh_y = row_bottom + max((row_top - row_bottom - mm(stem) - 16) / 2, 0)
    panels = (
        (3, "PANTALLA - CARA DEL TERRENO", panel, stem, "pantalla", "principal", "pantalla", "transversal"),
        (4, "PANTALLA - CARA LIBRE", panel, stem, "pantalla", "secundario", "pantalla", "transversal2"),
        (5, "ZAPATA - MALLA SUPERIOR", base, panel, "talon", "principal", "talon", "transversal"),
        (6, "ZAPATA - MALLA INFERIOR", base, panel, "punta", "principal", "punta", "transversal"),
    )
    cursor = MESH_LEFT
    for number, title, width, height, *rows in panels:
        origin = Point(cursor * unit, mesh_y * unit)
        vertical = steel_row(steel, rows[0], rows[1])
        horizontal = steel_row(steel, rows[2], rows[3])
        mesh_view(sheet, origin, width, height, vertical, horizontal)
        view_title(sheet, Point(origin.x, (mesh_y - 16) * unit), number, title)
        cursor += mesh_step(width, scale)
    return Plan(scale, sheet, paper, title_block)
