"""Calidad de la lámina medida en mm de papel, sobre las entidades abstractas."""

import copy
import math
from itertools import combinations
from typing import NamedTuple

import pytest

from app.api.schemas.wall_plan import WallPlanRequest
from app.domain.sheet.scale import PAPER
from app.drawing.primitives import Dimension, Line, Polyline, Text
from app.drawing.sheet.layout import build_plan
from tests.conftest import SAMPLE

GLYPH_WIDTH = 0.62  # Ancho de Arial respecto a su altura, conservador para mayúsculas
TEXT_GAP = 1.0
BODY = 3
DRAWN_LAYERS = {"CONCRETO", "ACERO_PRINCIPAL"}


class Box(NamedTuple):
    left: float
    bottom: float
    right: float
    top: float
    label: str

    def overlaps(self, other: "Box") -> bool:
        return (
            self.left < other.right
            and other.left < self.right
            and self.bottom < other.top
            and other.bottom < self.top
        )

    def hit_by(self, a, b) -> bool:
        """Recorte de Liang-Barsky del segmento a-b contra la caja."""
        start, end = 0.0, 1.0
        dx, dy = b[0] - a[0], b[1] - a[1]
        for p, q in (
            (-dx, a[0] - self.left),
            (dx, self.right - a[0]),
            (-dy, a[1] - self.bottom),
            (dy, self.top - a[1]),
        ):
            if p == 0:
                if q < 0:
                    return False
                continue
            t = q / p
            if p < 0:
                start = max(start, t)
            else:
                end = min(end, t)
        return start < end


def text_box(entity: Text, unit: float) -> Box:
    height = entity.height / unit
    width = len(entity.value) * GLYPH_WIDTH * height
    x, y = entity.position.x / unit, entity.position.y / unit
    if entity.rotation == 90:
        return Box(x - height, y - width / 2, x, y + width / 2, entity.value)
    left = {"left": x, "center": x - width / 2, "right": x - width}[entity.align]
    return Box(left, y, left + width, y + height, entity.value)


def dimension_box(entity: Dimension, unit: float) -> Box:
    value = math.dist(entity.a, entity.b)
    label = entity.label.replace("<>", f"{value:.2f}")
    width = len(label) * GLYPH_WIDTH * BODY
    if entity.angle == 90:
        x = entity.line_point.x / unit
        middle = (entity.a.y + entity.b.y) / 2 / unit
        return Box(x - TEXT_GAP - BODY, middle - width / 2, x - TEXT_GAP, middle + width / 2, label)
    middle = (entity.a.x + entity.b.x) / 2 / unit
    y = entity.line_point.y / unit
    return Box(middle - width / 2, y + TEXT_GAP, middle + width / 2, y + TEXT_GAP + BODY, label)


def boxes(plan) -> list[Box]:
    unit = plan.model.unit
    found = [text_box(e, unit) for e in plan.model.entities if isinstance(e, Text)]
    found += [dimension_box(e, unit) for e in plan.model.entities if isinstance(e, Dimension)]
    found += [text_box(e, 1) for e in plan.paper.entities if isinstance(e, Text)]
    return found


def drawn_segments(plan):
    unit = plan.model.unit
    for entity in plan.model.entities:
        if entity.layer not in DRAWN_LAYERS:
            continue
        if isinstance(entity, Line):
            yield (entity.a.x / unit, entity.a.y / unit), (entity.b.x / unit, entity.b.y / unit)
        if isinstance(entity, Polyline):
            points = [(p.x / unit, p.y / unit) for p in entity.points]
            closing = [(points[-1], points[0])] if entity.closed else []
            yield from [*zip(points, points[1:], strict=False), *closing]


def full_steel(payload: dict) -> dict:
    row = {"label": "2 Ø 3/4 @ 20 cm + 2 Ø 5/8 @ 40 cm + r", "spacing": 20}
    group = {name: dict(row) for name in ("principal", "secundario", "transversal", "transversal2")}
    payload["steel"] = {name: copy.deepcopy(group) for name in ("pantalla", "punta", "talon", "key")}
    return payload


def wall(**geometry) -> dict:
    payload = full_steel(copy.deepcopy(SAMPLE))
    payload["geo"].update(geometry)
    return payload


NO_KEY = {"keyDepth": 0, "keyTop": 0, "keyBottom": 0, "keyX": 0}
WALLS = {
    "ejemplo": wall(),
    "sin-dentellon": wall(**NO_KEY),
    "bajo": wall(punta=0.3, batter=0.1, crown=0.2, heel=0.5, hz=0.3, stem=1.2, rise=0, front=0.4, **NO_KEY),
    "mediano": wall(
        punta=0.8, batter=0.2, crown=0.25, heel=1.6, hz=0.4, stem=3.2, rise=0.2, front=0.6, keyX=1
    ),
    "alto": wall(punta=3, batter=1, crown=0.3, heel=6, hz=1.2, stem=16, keyX=3),
}


@pytest.fixture(params=WALLS, ids=list(WALLS))
def plan(request):
    return build_plan(WallPlanRequest.model_validate(WALLS[request.param]))


def test_texts_do_not_overlap(plan):
    clashes = [(a.label, b.label) for a, b in combinations(boxes(plan), 2) if a.overlaps(b)]
    assert clashes == []


def test_texts_stay_out_of_the_title_block(plan):
    assert [box.label for box in boxes(plan) if box.right > PAPER.block_x] == []


def test_texts_do_not_cross_concrete_or_main_steel(plan):
    segments = list(drawn_segments(plan))
    crossed = {box.label for box in boxes(plan) if any(box.hit_by(a, b) for a, b in segments)}
    assert crossed == set()
