"""Lámina A1 y elección de escala. Medidas de lámina en milímetros de papel."""

from typing import NamedTuple

SCALES = (25, 30, 40, 50, 75, 100, 125, 150)
PANEL_WIDTH = 3.0  # Largo representativo de muro en las mallas, en metros


class Paper(NamedTuple):
    width: float = 841
    height: float = 594
    left: float = 25
    margin: float = 10
    block: float = 180

    @property
    def block_x(self) -> float:
        return self.width - self.margin - self.block


PAPER = Paper()
CONTENT_LEFT = PAPER.left + 15
CONTENT_TOP = PAPER.height - PAPER.margin - 25
SECTION_MARGIN = 0.7  # Terreno a cada lado de la sección, en metros
SECTION_ANNOTATION = 95
TABLE_COLUMN = 130
MESH_GAP = 58
MESH_MIN_STEP = 110  # Reserva el ancho del título bajo las mallas angostas
MESH_LEFT = CONTENT_LEFT + 10


class PlanDoesNotFit(Exception):
    """El muro no entra en la lámina ni a la menor escala disponible."""


def to_paper(meters: float, scale: int) -> float:
    return meters * 1000 / scale


def section_width(base: float, scale: int) -> float:
    return to_paper(base + 2 * SECTION_MARGIN, scale) + SECTION_ANNOTATION


def mesh_step(width: float, scale: int) -> float:
    return max(to_paper(width, scale) + MESH_GAP, MESH_MIN_STEP)


def choose_scale(geo) -> int:
    """La mayor escala en la que caben las secciones, los cuadros y las mallas."""
    base = geo.base
    tall = geo.hz + geo.stem + geo.rise + geo.keyDepth
    panel = min(PANEL_WIDTH, base)
    usable_width = PAPER.width - PAPER.left - PAPER.margin - PAPER.block - 20
    usable_height = PAPER.height - 2 * PAPER.margin - 20

    for scale in SCALES:
        sections_fit = 2 * section_width(base, scale) + TABLE_COLUMN <= usable_width
        rows_fit = to_paper(tall, scale) + to_paper(geo.stem, scale) + 140 <= usable_height
        meshes = MESH_LEFT + 2 * mesh_step(panel, scale) + 2 * mesh_step(base, scale)
        if sections_fit and rows_fit and meshes <= PAPER.block_x:
            return scale
    raise PlanDoesNotFit
