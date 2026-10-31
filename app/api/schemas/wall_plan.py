"""Contrato de entrada del plano. Valida forma y rangos; no calcula ingeniería."""

from typing import Annotated, Self

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator
from pydantic_core import PydanticCustomError

MAX_METERS = 100

Length = Annotated[float, Field(ge=0, le=MAX_METERS)]
PositiveLength = Annotated[float, Field(gt=0, le=MAX_METERS)]
Stress = Annotated[float, Field(gt=0, le=100_000)]
Cover = Annotated[float, Field(gt=0, le=50)]
Spacing = Annotated[float, Field(gt=0, le=100, strict=False)]


def _blank_as_dash(value: object) -> object:
    return "-" if value is None or value == "" else value


def _unset_spacing(value: object) -> object:
    return None if value in ("", 0, "0") else value


def _rule(message: str, *fields: str) -> PydanticCustomError:
    return PydanticCustomError("contract_rule", message, {"fields": list(fields)})


ProjectText = Annotated[str, BeforeValidator(_blank_as_dash), Field(max_length=300)]


class Contract(BaseModel):
    """Números estrictos y sin NaN ni infinito. Los campos desconocidos se ignoran."""

    model_config = ConfigDict(strict=True, allow_inf_nan=False, str_strip_whitespace=True)


class Geometry(Contract):
    model_config = ConfigDict(extra="forbid")

    punta: Length
    batter: Length
    crown: PositiveLength
    heel: Length
    hz: PositiveLength
    stem: PositiveLength
    rise: Length = 0
    keyX: Length = 0
    keyTop: Length = 0
    keyBottom: Length = 0
    keyDepth: Length = 0
    front: Length = 0
    surcharge: Annotated[float, Field(ge=0, le=1000)] = 0

    @property
    def base(self) -> float:
        return self.punta + self.batter + self.crown + self.heel

    @model_validator(mode="after")
    def check_key_and_ground(self) -> Self:
        if self.keyDepth > 0:
            if self.keyTop <= 0:
                raise _rule("geo.keyTop debe ser mayor que 0 si hay dentellón", "geo.keyTop")
            if self.keyBottom > self.keyTop:
                raise _rule("geo.keyBottom no puede superar a geo.keyTop", "geo.keyBottom", "geo.keyTop")
            if self.keyX > self.base:
                raise _rule("geo.keyX debe estar dentro de la base", "geo.keyX")
        if self.front > self.hz + self.stem:
            raise _rule("geo.front no puede superar la altura total", "geo.front")
        return self


class SteelRow(Contract):
    label: Annotated[str, Field(min_length=1, max_length=40)]
    # Viene de campos de la hoja: admite "20", y 0 o vacío si aún no hay diseño.
    spacing: Annotated[Spacing | None, BeforeValidator(_unset_spacing)] = None


class SteelElement(Contract):
    principal: SteelRow | None = None
    secundario: SteelRow | None = None
    transversal: SteelRow | None = None
    transversal2: SteelRow | None = None


class Steel(Contract):
    pantalla: SteelElement | None = None
    punta: SteelElement | None = None
    talon: SteelElement | None = None
    key: SteelElement | None = None


class Cutoff(Contract):
    L: Length = 0


class Cutoffs(Contract):
    pantalla: Cutoff | None = None
    talon: Cutoff | None = None
    pedestal: Cutoff | None = None


class Materials(Contract):
    fc: Stress
    fy: Stress
    qadm: Stress
    recubrimientoPantalla: Cover = 5.0  # cm
    recubrimientoZapata: Cover = 7.5  # cm


class Project(Contract):
    model_config = ConfigDict(strict=False, coerce_numbers_to_str=True)

    proyecto: ProjectText = "-"
    codigo: ProjectText = "-"
    cliente: ProjectText = "-"
    ubicacion: ProjectText = "-"
    ingeniero: ProjectText = "-"
    fecha: ProjectText = "-"
    lamina: ProjectText = "E-1"


class WallPlanRequest(Contract):
    geo: Geometry
    steel: Steel = Steel()
    cutoffs: Cutoffs | None = None
    materials: Materials
    project: Project = Project()
