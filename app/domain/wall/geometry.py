"""Contorno del muro. Origen en la punta, al nivel inferior de la zapata."""

from typing import NamedTuple


class Point(NamedTuple):
    x: float
    y: float


def back_x(geo) -> float:
    """Cara de la pantalla del lado del terreno."""
    return geo.punta + geo.batter + geo.crown


def top_y(geo) -> float:
    return geo.hz + geo.stem


def key_points(geo) -> tuple[Point, Point, Point, Point] | None:
    """Arranque izquierdo, fondo izquierdo, fondo derecho y arranque derecho."""
    if geo.keyDepth <= 0:
        return None
    left = max(geo.keyX - geo.keyTop / 2, 0)
    right = min(geo.keyX + geo.keyTop / 2, geo.base)
    inset = max((right - left - geo.keyBottom) / 2, 0)
    return (
        Point(left, 0),
        Point(left + inset, -geo.keyDepth),
        Point(right - inset, -geo.keyDepth),
        Point(right, 0),
    )


def wall_outline(geo) -> list[Point]:
    back, top = back_x(geo), top_y(geo)
    return [
        Point(0, 0),
        *(key_points(geo) or ()),
        Point(geo.base, 0),
        Point(geo.base, geo.hz),
        Point(back, geo.hz),
        Point(back, top),
        Point(back - geo.crown, top),
        Point(geo.punta, geo.hz),
        Point(0, geo.hz),
    ]
