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


@dataclass(frozen=True)
class Hatch:
    layer: str
    boundary: tuple[Point, ...]
    pattern: str
    scale: float
    color: int
    holes: tuple[tuple[Point, ...], ...] = ()


@dataclass(frozen=True)
class Dimension:
    """Cota lineal real. `label` usa <> como marcador del valor medido."""

    layer: str
    a: Point
    b: Point
    line_point: Point
    angle: float
    label: str = "<>"


@dataclass(frozen=True)
class Attribute:
    """Dato editable del membrete."""

    layer: str
    position: Point
    height: float
    tag: str
    value: str
    align: Align = "left"


Entity = Line | Polyline | Circle | Text | Hatch | Dimension | Attribute


@dataclass
class Sheet:
    """Lista de entidades. Los tamaños de anotación entran en mm de papel.

    En el modelo la unidad es el metro, según la escala; en el papel, el milímetro.
    """

    scale: int
    paper: bool = False
    entities: list[Entity] = field(default_factory=list)

    @property
    def unit(self) -> float:
        return 1 if self.paper else self.scale / 1000

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

    def hatch(self, layer: str, boundary, style, holes=()) -> None:
        self.entities.append(
            Hatch(
                layer,
                tuple(Point(*p) for p in boundary),
                style.pattern,
                style.scale * self.unit,
                style.color,
                tuple(tuple(Point(*p) for p in hole) for hole in holes),
            )
        )

    def dimension(
        self, layer: str, a: Point, b: Point, line_point: Point, angle: float, label: str = "<>"
    ) -> None:
        self.entities.append(Dimension(layer, Point(*a), Point(*b), Point(*line_point), angle, label))

    def attribute(
        self,
        layer: str,
        position: Point,
        height_mm: float,
        tag: str,
        value: str,
        align: Align = "left",
    ) -> None:
        self.entities.append(
            Attribute(layer, Point(*position), height_mm * self.unit, tag, str(value), align)
        )


@dataclass
class Plan:
    """Lámina completa: vistas en modelo; marco y cuadros en papel; membrete en bloque."""

    scale: int
    model: Sheet
    paper: Sheet
    title_block: Sheet
