"""Escritor DXF: único módulo que conoce ezdxf."""

import io

import ezdxf
from ezdxf.enums import TextEntityAlignment
from ezdxf.layouts import Modelspace

from app.drawing.primitives import Circle, Line, Polyline, Sheet, Text
from app.standards.layers import LAYERS
from app.standards.typography import FONT_FILE, FONT_STYLE

METERS = 6
ALIGNMENT = {
    "left": TextEntityAlignment.LEFT,
    "center": TextEntityAlignment.CENTER,
    "right": TextEntityAlignment.RIGHT,
}


def dxf_text(value: str) -> str:
    return value.replace("Ø", "%%c").replace("°", "%%d")


def _draw(space: Modelspace, entity) -> None:
    attributes = {"layer": entity.layer}
    match entity:
        case Line():
            space.add_line(entity.a, entity.b, dxfattribs=attributes)
        case Polyline():
            space.add_lwpolyline(entity.points, close=entity.closed, dxfattribs=attributes)
        case Circle():
            space.add_circle(entity.center, entity.radius, dxfattribs=attributes)
        case Text():
            text = space.add_text(
                dxf_text(entity.value),
                height=entity.height,
                rotation=entity.rotation,
                dxfattribs={**attributes, "style": FONT_STYLE},
            )
            text.set_placement(entity.position, align=ALIGNMENT[entity.align])


def render_dxf(sheet: Sheet) -> bytes:
    document = ezdxf.new("R2013", setup=False, units=METERS)
    document.header["$LTSCALE"] = sheet.unit
    document.header["$LWDISPLAY"] = 1
    document.styles.add(FONT_STYLE, font=FONT_FILE)
    for name, style in LAYERS.items():
        document.layers.add(name, color=style.color, lineweight=style.lineweight)

    space = document.modelspace()
    for entity in sheet.entities:
        _draw(space, entity)

    stream = io.StringIO()
    document.write(stream)
    return stream.getvalue().encode("utf-8")
