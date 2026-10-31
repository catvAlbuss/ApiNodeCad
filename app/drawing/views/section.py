"""Vistas 1 y 2: sección típica con dimensiones y con refuerzo."""

from app.domain.sheet.scale import SECTION_MARGIN
from app.domain.wall.geometry import Point, back_x, key_points, top_y, wall_outline
from app.domain.wall.reinforcement import (
    LAYER_OFFSET,
    cutoff_length,
    section_steel,
    steel_row,
)
from app.drawing.annotations import dimension, fixed, ground, leader, shift
from app.drawing.primitives import Sheet
from app.standards import typography as type_size


def draw_wall(sheet: Sheet, origin: Point, geo) -> None:
    def at(x: float, y: float) -> Point:
        return shift(origin, Point(x, y))

    back, base, top = back_x(geo), geo.base, top_y(geo)
    heel_top = top + geo.rise
    sheet.poly("CONCRETO", [shift(origin, p) for p in wall_outline(geo)], closed=True)
    ground(sheet, at(back, top), at(base, heel_top))
    ground(sheet, at(base, heel_top), at(base + SECTION_MARGIN, heel_top))
    if geo.front > 0:
        face = geo.punta + geo.batter * max(geo.front - geo.hz, 0) / geo.stem
        ground(sheet, at(-SECTION_MARGIN, geo.front), at(face, geo.front))


def geometry_view(sheet: Sheet, origin: Point, geo) -> None:
    def at(x: float, y: float) -> Point:
        return shift(origin, Point(x, y))

    back, base, top = back_x(geo), geo.base, top_y(geo)
    low = -geo.keyDepth
    draw_wall(sheet, origin, geo)

    def under(a: float, b: float, offset: float, label: str | None = None) -> None:
        dimension(sheet, at(a, low), at(b, low), offset, label)

    under(0, geo.punta, -10)
    under(geo.punta, back, -10)
    under(back, base, -10)
    under(0, base, -20, f"B = {fixed(base)}")
    right = base + SECTION_MARGIN
    dimension(sheet, at(right, top), at(right, geo.hz), 8)
    dimension(sheet, at(right, geo.hz), at(right, 0), 8)
    dimension(sheet, at(right, top), at(right, 0), 18, f"H = {fixed(top)}")
    dimension(sheet, at(back - geo.crown, top), at(back, top), 8)
    if geo.front > 0:
        dimension(sheet, at(-SECTION_MARGIN, 0), at(-SECTION_MARGIN, geo.front), 8)
    key = key_points(geo)
    if key:
        dimension(sheet, at(-SECTION_MARGIN, low), at(-SECTION_MARGIN, 0), 8)
        dimension(sheet, shift(origin, key[1]), shift(origin, key[2]), -30)
    sheet.text(
        "TEXTO", at(back + geo.heel * 0.5, geo.hz + geo.stem * 0.5), type_size.BODY, "RELLENO", "center"
    )
    zapata_y = (geo.hz - type_size.BODY * sheet.unit) / 2
    sheet.text("TEXTO", at(back + geo.heel * 0.5, zapata_y), type_size.BODY, "ZAPATA", "center")


def reinforcement_view(sheet: Sheet, origin: Point, plan) -> None:
    geo, steel = plan.geo, plan.steel
    bars = section_steel(geo, steel, plan.cutoffs, plan.materials)
    draw_wall(sheet, origin, geo)

    def at(x: float, y: float) -> Point:
        return shift(origin, Point(x, y))

    for path in bars.main:
        sheet.poly("ACERO_PRINCIPAL", [shift(origin, p) for p in path])
    for dot in bars.transverse:
        sheet.circle("ACERO_SECUNDARIO", shift(origin, dot), 0.6 * sheet.unit)

    def label(element: str, name: str) -> str:
        row = steel_row(steel, element, name)
        return row.label if row else "-"

    base, hz, stem = geo.base, geo.hz, geo.stem
    clearance = SECTION_MARGIN + 4 * sheet.unit
    right = base + clearance
    left = -clearance
    offset = LAYER_OFFSET
    inner, foot_top, foot_cover = bars.inner_x, bars.foot_top, bars.foot_cover
    leader(sheet, at(inner, hz + stem * 0.8), at(right, hz + stem * 0.86), label("pantalla", "principal"))
    leader(
        sheet,
        at(inner - offset, hz + stem * 0.6),
        at(right, hz + stem * 0.66),
        f"{label('pantalla', 'transversal')} (transv.)",
    )
    outer_72, outer_50 = bars.outer_at(0.72), bars.outer_at(0.5)
    leader(sheet, at(*outer_72), at(left, hz + stem * 0.8), label("pantalla", "secundario"), "right")
    leader(
        sheet,
        at(outer_50.x + offset, outer_50.y),
        at(left, hz + stem * 0.6),
        f"{label('pantalla', 'transversal2')} (transv.)",
        "right",
    )
    leader(
        sheet, at(base * 0.8, foot_top), at(right, hz + stem * 0.22), f"{label('talon', 'principal')} (talón)"
    )
    leader(
        sheet,
        at(base * 0.9, foot_top - offset),
        at(right, hz + stem * 0.06),
        f"{label('talon', 'transversal')} (transv.)",
    )
    leader(
        sheet,
        at(geo.punta * 0.4, foot_cover),
        at(left, geo.front + 0.9),
        f"{label('punta', 'principal')} (punta)",
        "right",
    )
    leader(
        sheet,
        at(geo.punta * 0.2, foot_cover + offset),
        at(left, geo.front + 0.35),
        f"{label('punta', 'transversal')} (transv.)",
        "right",
    )
    if geo.keyDepth > 0:
        leader(
            sheet,
            at(geo.keyX, -geo.keyDepth * 0.6),
            at(right, -geo.keyDepth - 10 * sheet.unit),
            f"{label('key', 'principal')} (dentellón)",
        )
    stem_cutoff = cutoff_length(plan.cutoffs, "pantalla")
    if stem_cutoff > 0:
        x = inner + 8 * sheet.unit
        dimension(sheet, at(x, hz), at(x, hz + min(stem_cutoff, stem)), -6, f"Recorte {fixed(stem_cutoff)}")
    heel_cutoff = cutoff_length(plan.cutoffs, "talon")
    if heel_cutoff > 0:
        end = min(inner + heel_cutoff, base)
        dimension(sheet, at(inner, 0), at(end, 0), -5, f"Recorte {fixed(heel_cutoff)}")
