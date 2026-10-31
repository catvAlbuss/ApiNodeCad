"""Tramas normalizadas. La escala se expresa en mm de papel por unidad de patrón."""

from typing import NamedTuple


class HatchStyle(NamedTuple):
    pattern: str
    scale: float
    color: int


CONCRETE = HatchStyle("AR-CONC", 0.05, 8)
SOIL = HatchStyle("EARTH", 0.5, 8)
