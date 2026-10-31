"""Escritor DXF: único módulo que conoce ezdxf."""

import io

import ezdxf
from ezdxf.document import Drawing
from ezdxf.enums import TextEntityAlignment

from app.domain.sheet.scale import PAPER
from app.drawing.primitives import (
    Attribute,
    Circle,
    Dimension,
    Hatch,
    Line,
    Plan,
    Polyline,
    Sheet,
    Text,
)
from app.standards import typography as type_size
from app.standards.layers import LAYERS

METERS = 6
FONT_STYLE = type_size.FONT_STYLE
DIMENSION_STYLE = "COTA_PLANO"
BLOCK_NAME = "MEMBRETE_A1"
LAYOUT_NAME = "A1"
PAGE_NAME = "ISO_full_bleed_A1_(841.00_x_594.00_MM)"
PLOT_STYLE = "monochrome.ctb"
VIEWPORT_LAYER = "Defpoints"  # AutoCAD no imprime esta capa
LOCK_VIEWPORT = 16384
ALIGNMENT = {
    "left": TextEntityAlignment.LEFT,
    "center": TextEntityAlignment.CENTER,
    "right": TextEntityAlignment.RIGHT,
}


def dxf_text(value: str) -> str:
    return value.replace("Ø", "%%c").replace("°", "%%d")


def _draw(space, entity) -> None:
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
        case Hatch():
            hatch = space.add_hatch(color=entity.color, dxfattribs=attributes)
            hatch.paths.add_polyline_path(entity.boundary, is_closed=True)
            for hole in entity.holes:
                hatch.paths.add_polyline_path(hole, is_closed=True)
            hatch.set_pattern_fill(entity.pattern, color=entity.color, scale=entity.scale)
        case Dimension():
            space.add_linear_dim(
                base=entity.line_point,
                p1=entity.a,
                p2=entity.b,
                angle=entity.angle,
                text=dxf_text(entity.label),
                dimstyle=DIMENSION_STYLE,
                dxfattribs=attributes,
            ).render()
        case Attribute():
            definition = space.add_attdef(
                entity.tag,
                text=dxf_text(entity.value),
                height=entity.height,
                dxfattribs={**attributes, "style": FONT_STYLE},
            )
            definition.set_placement(entity.position, align=ALIGNMENT[entity.align])


def _prepare_tables(document: Drawing, scale: int) -> None:
    document.styles.add(FONT_STYLE, font=type_size.FONT_FILE)
    for name, style in LAYERS.items():
        document.layers.add(name, color=style.color, lineweight=style.lineweight)
    document.layers.get(VIEWPORT_LAYER).dxf.plot = 0

    style = document.dimstyles.new(DIMENSION_STYLE)
    style.dxf.dimscale = scale / 1000  # Tamaños del estilo en mm de papel; modelo en metros
    style.dxf.dimtxt = type_size.BODY
    style.dxf.dimtxsty = FONT_STYLE
    style.dxf.dimtsz = 1.2  # Trazo a 45° en lugar de flecha
    style.dxf.dimexo = 1.5
    style.dxf.dimexe = 1.5
    style.dxf.dimgap = 1
    style.dxf.dimtad = 1  # Valor sobre la línea
    style.dxf.dimtih = 0  # Alineado con la cota
    style.dxf.dimtoh = 0
    style.dxf.dimdec = 2
    style.dxf.dimzin = 0
    style.dxf.dimdsep = ord(".")


def _write_title_block(document: Drawing, sheet: Sheet, layout) -> None:
    block = document.blocks.new(BLOCK_NAME)
    for entity in sheet.entities:
        _draw(block, entity)
    values = {e.tag: dxf_text(e.value) for e in sheet.entities if isinstance(e, Attribute)}
    layout.add_blockref(BLOCK_NAME, (0, 0), dxfattribs={"layer": "MEMBRETE"}).add_auto_attribs(values)


def _write_paper(document: Drawing, plan: Plan) -> None:
    layout = document.layouts.get("Layout1")
    document.layouts.rename("Layout1", LAYOUT_NAME)
    layout.page_setup(size=(PAPER.width, PAPER.height), scale=1, name=PAGE_NAME)
    layout.dxf_layout.dxf.current_style_sheet = PLOT_STYLE

    # Una ventana a escala exacta sobre la zona de vistas: modelo en m, papel en mm.
    left, right = PAPER.left, PAPER.block_x
    bottom, top = PAPER.margin, PAPER.height - PAPER.margin
    center = ((left + right) / 2, (bottom + top) / 2)
    unit = plan.model.unit
    viewport = layout.add_viewport(
        center=center,
        size=(right - left, top - bottom),
        view_center_point=(center[0] * unit, center[1] * unit),
        view_height=(top - bottom) * unit,
        dxfattribs={"layer": VIEWPORT_LAYER},
    )
    viewport.dxf.flags |= LOCK_VIEWPORT

    for entity in plan.paper.entities:
        _draw(layout, entity)
    _write_title_block(document, plan.title_block, layout)
    document.layouts.set_active_layout(LAYOUT_NAME)


def render_dxf(plan: Plan) -> bytes:
    document = ezdxf.new("R2013", setup=False, units=METERS)
    document.header["$LWDISPLAY"] = 1
    _prepare_tables(document, plan.scale)

    modelspace = document.modelspace()
    for entity in plan.model.entities:
        _draw(modelspace, entity)
    _write_paper(document, plan)

    stream = io.StringIO()
    document.write(stream)
    return stream.getvalue().encode("utf-8")
