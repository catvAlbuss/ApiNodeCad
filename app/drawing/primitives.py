"""Entidades abstractas: el dibujo no conoce el formato de salida."""

from dataclasses import dataclass, field
from typing import Literal

from app.domain.wall.geometry import Point

Align = Literal["left", "center", "right"]


@dataclass(frozen=True)
class Line:
    layer: str
    a: Point
    b: Point


@dataclass(frozen=True)
class Polyline:
    layer: str
    points: tuple[Point, ...]
    closed: bool = False


@dataclass(frozen=True)
class Circle:
    layer: str
    center: Point
    radius: float


@dataclass(frozen=True)
class Text:
    layer: str
    position: Point
    height: float
    value: str
    align: Align = "left"
    rotation: float = 0


Entity = Line | Polyline | Circle | Text


@dataclass
class Sheet:
    """Lámina en metros de modelo; los tamaños de anotación entran en mm de papel."""

    scale: int
    entities: list[Entity] = field(default_factory=list)

    @property
    def unit(self) -> float:
        return self.scale / 1000

    def line(self, layer: str, a: Point, b: Point) -> None:
        self.entities.append(Line(layer, Point(*a), Point(*b)))

    def poly(self, layer: str, points, closed: bool = False) -> None:
        self.entities.append(Polyline(layer, tuple(Point(*p) for p in points), closed))

    def circle(self, layer: str, center: Point, radius: float) -> None:
        self.entities.append(Circle(layer, Point(*center), radius))

    def text(
        self,
        layer: str,
        position: Point,
        height_mm: float,
        value: str,
        align: Align = "left",
        rotation: float = 0,
    ) -> None:
        self.entities.append(
            Text(layer, Point(*position), height_mm * self.unit, str(value), align, rotation)
        )
