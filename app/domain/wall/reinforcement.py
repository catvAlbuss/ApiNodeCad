"""Trazado de barras en la sección. Dibuja lo recibido: no diseña ni calcula acero."""

import math
from dataclasses import dataclass, field

from app.domain.wall.geometry import Point, back_x, key_points, top_y

LAYER_OFFSET = 0.03  # Barra transversal respecto a la principal
CUTOFF_OFFSET = 0.05  # Barra recortada respecto a la continua
KEY_INSET = 0.07
HOOK_INNER = 0.4
HOOK_OUTER = 0.3
KEY_LAP = 0.15
MIN_SPACING = 0.05


def spacing_m(row) -> float | None:
    """Separación en metros, o None si aún no hay diseño."""
    if row is None or row.spacing is None:
        return None
    return max(row.spacing / 100, MIN_SPACING)


def steel_row(steel, element: str, name: str):
    group = getattr(steel, element)
    return getattr(group, name) if group else None


def cutoff_length(cutoffs, element: str) -> float:
    entry = getattr(cutoffs, element) if cutoffs else None
    return entry.L if entry else 0


def dots_along(start: Point, end: Point, spacing: float | None) -> list[Point]:
    if spacing is None:
        return []
    length = math.dist(start, end)
    count = max(math.floor(length / spacing), 1)
    return [
        Point(start.x + (end.x - start.x) * i / count, start.y + (end.y - start.y) * i / count)
        for i in range(count + 1)
    ]


@dataclass
class SectionSteel:
    main: list[list[Point]] = field(default_factory=list)
    transverse: list[Point] = field(default_factory=list)
    inner_x: float = 0
    foot_top: float = 0
    foot_cover: float = 0
    outer_bottom: Point = Point(0, 0)
    outer_top: Point = Point(0, 0)

    def outer_at(self, t: float) -> Point:
        a, b = self.outer_bottom, self.outer_top
        return Point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)


def section_steel(geo, steel, cutoffs, materials) -> SectionSteel:
    wall_cover = materials.recubrimientoPantalla / 100
    foot_cover = materials.recubrimientoZapata / 100
    back, base, top = back_x(geo), geo.base, top_y(geo)
    inner = back - wall_cover
    top_bar = top - wall_cover
    foot_top = geo.hz - foot_cover
    outer_bottom = Point(geo.punta + wall_cover, foot_top)
    outer_top = Point(back - geo.crown + wall_cover, top_bar)
    bars = SectionSteel(
        inner_x=inner,
        foot_top=foot_top,
        foot_cover=foot_cover,
        outer_bottom=outer_bottom,
        outer_top=outer_top,
    )

    bars.main += [
        [Point(inner + HOOK_INNER, foot_cover), Point(inner, foot_cover), Point(inner, top_bar)],
        [Point(outer_bottom.x - HOOK_OUTER, foot_cover), Point(outer_bottom.x, foot_cover), outer_top],
        [
            Point(foot_cover, foot_top),
            Point(foot_cover, foot_cover),
            Point(base - foot_cover, foot_cover),
            Point(base - foot_cover, foot_top),
            Point(foot_cover, foot_top),
        ],
    ]
    stem_cutoff = cutoff_length(cutoffs, "pantalla")
    if stem_cutoff > 0:
        x = inner - CUTOFF_OFFSET
        bars.main.append([Point(x, foot_cover), Point(x, min(geo.hz + stem_cutoff, top_bar))])
    heel_cutoff = cutoff_length(cutoffs, "talon")
    if heel_cutoff > 0:
        y = foot_top - CUTOFF_OFFSET
        bars.main.append([Point(inner, y), Point(min(inner + heel_cutoff, base - foot_cover), y)])

    key = key_points(geo)
    if key:
        bars.main.append(
            [
                Point(key[1].x - KEY_LAP, geo.hz * 0.5),
                Point(key[1].x + KEY_INSET, -geo.keyDepth + KEY_INSET),
                Point(key[2].x - KEY_INSET, -geo.keyDepth + KEY_INSET),
                Point(key[2].x + KEY_LAP, geo.hz * 0.5),
            ]
        )

    offset = LAYER_OFFSET
    bars.transverse += dots_along(
        Point(inner - offset, geo.hz + 0.1),
        Point(inner - offset, top_bar - 0.05),
        spacing_m(steel_row(steel, "pantalla", "transversal")),
    )
    bars.transverse += dots_along(
        Point(outer_bottom.x + offset + 0.02, geo.hz + 0.1),
        Point(outer_top.x + offset, top_bar - 0.05),
        spacing_m(steel_row(steel, "pantalla", "transversal2")),
    )
    bars.transverse += dots_along(
        Point(foot_cover + 0.05, foot_top - offset),
        Point(base - foot_cover - 0.05, foot_top - offset),
        spacing_m(steel_row(steel, "talon", "transversal")),
    )
    bars.transverse += dots_along(
        Point(foot_cover + 0.05, foot_cover + offset),
        Point(base - foot_cover - 0.05, foot_cover + offset),
        spacing_m(steel_row(steel, "punta", "transversal")),
    )
    return bars
