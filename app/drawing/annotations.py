"""Cotas, referencias, títulos de vista y terreno."""

import math

from app.domain.wall.geometry import Point
from app.drawing.primitives import Align, Sheet
from app.standards import typography as type_size

COTAS = "COTAS"
TEXTO = "TEXTO"
TERRENO = "TERRENO"


def fixed(value: float, decimals: int = 2) -> str:
    return f"{value:.{decimals}f}"


def shift(origin: Point, p: Point) -> Point:
    return Point(origin.x + p.x, origin.y + p.y)


def dimension(sheet: Sheet, a: Point, b: Point, offset_mm: float, label: str | None = None) -> None:
    """Cota con extensiones, trazos a 45° y valor sobre la línea."""
    length = math.dist(a, b)
    if length < 1e-6:
        return
    unit = sheet.unit
    ux, uy = (b.x - a.x) / length, (b.y - a.y) / length
    nx, ny = -uy, ux
    distance = offset_mm * unit
    side = math.copysign(1, offset_mm)

    def along_normal(p: Point, d: float) -> Point:
        return Point(p.x + nx * d, p.y + ny * d)

    start, end = along_normal(a, distance), along_normal(b, distance)
    gap = 1.5 * unit * side
    sheet.line(COTAS, along_normal(a, gap), along_normal(start, gap))
    sheet.line(COTAS, along_normal(b, gap), along_normal(end, gap))
    sheet.line(COTAS, start, end)
    tick = 1.2 * unit
    for p in (start, end):
        sheet.line(
            COTAS,
            Point(p.x - (ux + nx) * tick, p.y - (uy + ny) * tick),
            Point(p.x + (ux + nx) * tick, p.y + (uy + ny) * tick),
        )
    vertical = abs(uy) > 0.9
    middle = Point((start.x + end.x) / 2, (start.y + end.y) / 2)
    place = Point(middle.x - unit, middle.y) if vertical else Point(middle.x, middle.y + unit)
    sheet.text(COTAS, place, type_size.BODY, label or fixed(length), "center", 90 if vertical else 0)


def leader(sheet: Sheet, target: Point, elbow: Point, label: str, align: Align = "left") -> None:
    run = (1 if align == "left" else -1) * 4 * sheet.unit
    end = Point(elbow.x + run, elbow.y)
    sheet.poly(COTAS, [target, elbow, end])
    place = Point(end.x + run / 2, end.y - type_size.BODY * sheet.unit / 2)
    sheet.text(TEXTO, place, type_size.BODY, label, align)


def ground(sheet: Sheet, a: Point, b: Point) -> None:
    sheet.line(TERRENO, a, b)
    length = math.dist(a, b)
    step, size = 4 * sheet.unit, 2 * sheet.unit
    distance = step / 2
    while distance < length:
        t = distance / length
        p = Point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
        sheet.line(TERRENO, p, Point(p.x - size, p.y - size))
        distance += step


def view_title(sheet: Sheet, left: Point, number: int, title: str) -> None:
    unit = sheet.unit
    bubble = Point(left.x + 5 * unit, left.y)
    text_x = bubble.x + 8 * unit
    sheet.circle(TEXTO, bubble, 5 * unit)
    sheet.text(
        TEXTO,
        Point(bubble.x, bubble.y - type_size.SUBTITLE * unit / 2),
        type_size.SUBTITLE,
        str(number),
        "center",
    )
    sheet.text(TEXTO, Point(text_x, left.y + 0.3 * unit), type_size.SUBTITLE, title)
    sheet.line(
        TEXTO,
        Point(text_x, left.y - unit),
        Point(bubble.x + (8 + len(title) * 3.1) * unit, left.y - unit),
    )
    sheet.text(TEXTO, Point(text_x, left.y - 5 * unit), type_size.BODY, f"ESC. 1:{sheet.scale}")
