"""Cotas, referencias, títulos de vista y terreno."""

import math
import textwrap

from app.domain.wall.geometry import Point
from app.drawing.primitives import Align, Sheet
from app.standards import hatches
from app.standards import typography as type_size

COTAS = "COTAS"
TEXTO = "TEXTO"
TERRENO = "TERRENO"
GROUND_BAND = 5  # Espesor de la trama de terreno, en mm de papel
LEADER_WRAP = 24  # Caracteres por línea de una referencia
LEADER_LINE = 5  # Separación entre líneas de una referencia, en mm de papel
LEADER_GAP = 16  # Distancia mínima entre referencias apiladas, en mm de papel


def fixed(value: float, decimals: int = 2) -> str:
    return f"{value:.{decimals}f}"


def shift(origin: Point, p: Point) -> Point:
    return Point(origin.x + p.x, origin.y + p.y)


def dimension(sheet: Sheet, a: Point, b: Point, offset_mm: float, label: str = "<>") -> None:
    """Cota con el valor medido por CAD, a `offset_mm` de la recta a-b."""
    length = math.dist(a, b)
    if length < 1e-6:
        return
    ux, uy = (b.x - a.x) / length, (b.y - a.y) / length
    distance = offset_mm * sheet.unit
    line_point = Point(a.x - uy * distance, a.y + ux * distance)
    vertical = abs(uy) > 0.9
    if (uy if vertical else ux) < 0:  # Texto legible desde abajo o desde la derecha
        a, b = b, a
    sheet.dimension(COTAS, a, b, line_point, 90 if vertical else 0, label)


def leader(sheet: Sheet, target: Point, elbow: Point, label: str, align: Align = "left") -> None:
    run = (1 if align == "left" else -1) * 4 * sheet.unit
    end = Point(elbow.x + run, elbow.y)
    sheet.poly(COTAS, [target, elbow, end])
    x = end.x + run / 2
    for index, line in enumerate(textwrap.wrap(label, LEADER_WRAP)):
        y = end.y - (type_size.BODY / 2 + index * LEADER_LINE) * sheet.unit
        sheet.text(TEXTO, Point(x, y), type_size.BODY, line, align)


def stacked(heights: list[float], gap: float) -> list[float]:
    """Baja las alturas pedidas, de arriba abajo, hasta separarlas al menos `gap`."""
    placed: list[float] = []
    for height in heights:
        placed.append(min(height, placed[-1] - gap) if placed else height)
    return placed


def ground(sheet: Sheet, a: Point, b: Point, band_end: Point | None = None) -> None:
    """Línea de terreno con trama debajo; `band_end` ajusta su borde contra el muro."""
    band = GROUND_BAND * sheet.unit
    sheet.line(TERRENO, a, b)
    bottom_right = band_end or Point(b.x, b.y - band)
    sheet.hatch(TERRENO, [a, b, bottom_right, Point(a.x, bottom_right.y)], hatches.SOIL)


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
