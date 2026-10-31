"""Vista previa SVG de la lámina en mm de papel. Simplifica tramas y cotas."""

import math
from html import escape

from app.domain.sheet.scale import PAPER
from app.domain.wall.geometry import Point
from app.drawing.primitives import Attribute, Circle, Dimension, Line, Plan, Polyline, Sheet, Text

INK = {
    "TERRENO": "#7b6a4f",
    "ACERO_PRINCIPAL": "#b42318",
    "ACERO_SECUNDARIO": "#1959b8",
    "COTAS": "#2f6f4f",
}
DEFAULT_INK = "#1f2933"
ANCHOR = {"left": "start", "center": "middle", "right": "end"}


def _x(value: float) -> str:
    return f"{value:.3f}"


def _y(value: float) -> str:
    return f"{PAPER.height - value:.3f}"


def _segment(a: Point, b: Point, ink: str) -> str:
    return f'<line x1="{_x(a.x)}" y1="{_y(a.y)}" x2="{_x(b.x)}" y2="{_y(b.y)}" stroke="{ink}"/>'


def _text(position: Point, height: float, value: str, ink: str, align: str, rotation: float = 0) -> str:
    x, y = _x(position.x), _y(position.y)
    turn = f' transform="rotate({-rotation:g} {x} {y})"' if rotation else ""
    return (
        f'<text x="{x}" y="{y}" font-size="{height:.3f}" text-anchor="{ANCHOR[align]}" '
        f'fill="{ink}"{turn}>{escape(value)}</text>'
    )


def _dimension(entity: Dimension, ink: str, unit: float) -> str:
    a, b, on_line = (Point(p.x / unit, p.y / unit) for p in (entity.a, entity.b, entity.line_point))
    vertical = entity.angle == 90
    start = Point(on_line.x, a.y) if vertical else Point(a.x, on_line.y)
    end = Point(on_line.x, b.y) if vertical else Point(b.x, on_line.y)
    middle = Point((start.x + end.x) / 2, (start.y + end.y) / 2)
    label = entity.label.replace("<>", f"{math.dist(entity.a, entity.b):.2f}")
    place = Point(middle.x - 1, middle.y) if vertical else Point(middle.x, middle.y + 1)
    return (
        _segment(a, start, ink)
        + _segment(b, end, ink)
        + _segment(start, end, ink)
        + _text(place, 3, label, ink, "center", 90 if vertical else 0)
    )


def _entity(entity, unit: float) -> str:
    ink = INK.get(entity.layer, DEFAULT_INK)

    def paper(p: Point) -> Point:
        return Point(p.x / unit, p.y / unit)

    match entity:
        case Line():
            return _segment(paper(entity.a), paper(entity.b), ink)
        case Polyline():
            points = " ".join(f"{_x(p.x / unit)},{_y(p.y / unit)}" for p in entity.points)
            tag = "polygon" if entity.closed else "polyline"
            return f'<{tag} points="{points}" fill="none" stroke="{ink}"/>'
        case Circle():
            center = paper(entity.center)
            radius = entity.radius / unit
            attributes = f'cx="{_x(center.x)}" cy="{_y(center.y)}" r="{radius:.3f}"'
            return f'<circle {attributes} fill="none" stroke="{ink}"/>'
        case Text():
            return _text(
                paper(entity.position), entity.height / unit, entity.value, ink, entity.align, entity.rotation
            )
        case Attribute():
            return _text(paper(entity.position), entity.height / unit, entity.value, ink, entity.align)
        case Dimension():
            return _dimension(entity, ink, unit)
    return ""


def _sheet(sheet: Sheet) -> str:
    return "".join(_entity(entity, sheet.unit) for entity in sheet.entities)


def render_svg(plan: Plan) -> bytes:
    body = _sheet(plan.paper) + _sheet(plan.title_block) + _sheet(plan.model)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAPER.width:g} {PAPER.height:g}" '
        f'role="img" aria-label="Vista previa del plano" font-family="Arial, Helvetica, sans-serif" '
        f'stroke-width="0.25"><rect width="{PAPER.width:g}" height="{PAPER.height:g}" fill="#fff"/>'
        f"{body}</svg>"
    ).encode()
