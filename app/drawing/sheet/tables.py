"""Cuadro de acero, especificaciones técnicas y notas."""

from app.domain.wall.geometry import Point
from app.domain.wall.reinforcement import cutoff_length, steel_row
from app.drawing.annotations import fixed
from app.drawing.primitives import Sheet
from app.standards import typography as type_size

TEXTO = "TEXTO"
COLUMNS = (62, 58)
ROW_HEIGHT = 8

STEEL_ROWS = (
    ("Pantalla, cara terreno", "pantalla", "principal"),
    ("Pantalla, cara libre", "pantalla", "secundario"),
    ("Pantalla, transv. terreno", "pantalla", "transversal"),
    ("Pantalla, transv. libre", "pantalla", "transversal2"),
    ("Punta, principal", "punta", "principal"),
    ("Punta, transversal", "punta", "transversal"),
    ("Talón, principal", "talon", "principal"),
    ("Talón, transversal", "talon", "transversal"),
    ("Dentellón, principal", "key", "principal"),
)


def table(sheet: Sheet, origin: Point, rows: list[tuple[str, str]], title: str) -> float:
    """Dibuja el cuadro y devuelve la coordenada de su borde inferior."""
    unit = sheet.unit
    total = sum(COLUMNS) * unit
    y = origin.y
    sheet.text(TEXTO, Point(origin.x, y + 2 * unit), type_size.SUBTITLE, title)
    for row in rows:
        sheet.line(TEXTO, Point(origin.x, y), Point(origin.x + total, y))
        x = origin.x
        for cell, width in zip(row, COLUMNS, strict=True):
            sheet.text(TEXTO, Point(x + 1.5 * unit, y - 5.5 * unit), type_size.BODY, cell)
            x += width * unit
        y -= ROW_HEIGHT * unit
    sheet.line(TEXTO, Point(origin.x, y), Point(origin.x + total, y))
    x = origin.x
    for width in (*COLUMNS, 0):
        sheet.line(TEXTO, Point(x, origin.y), Point(x, y))
        x += width * unit
    return y


def tables_and_notes(sheet: Sheet, origin: Point, plan) -> None:
    unit = sheet.unit

    def steel_label(element: str, name: str) -> str:
        row = steel_row(plan.steel, element, name)
        return row.label if row else "-"

    after_steel = table(
        sheet,
        origin,
        [("ELEMENTO", "ACERO"), *((name, steel_label(e, row)) for name, e, row in STEEL_ROWS)],
        "CUADRO DE ACERO",
    )
    materials = plan.materials
    after_specs = table(
        sheet,
        Point(origin.x, after_steel - 16 * unit),
        [
            ("ESPECIFICACIÓN", "VALOR"),
            ("Concreto f'c", f"{fixed(materials.fc, 0)} kg/cm²"),
            ("Acero fy", f"{fixed(materials.fy, 0)} kg/cm²"),
            ("Capacidad portante", f"{fixed(materials.qadm)} Tn/m²"),
            ("Recubrimiento pantalla", f"{fixed(materials.recubrimientoPantalla, 1)} cm"),
            ("Recubrimiento zapata", f"{fixed(materials.recubrimientoZapata, 1)} cm"),
        ],
        "ESPECIFICACIONES TÉCNICAS",
    )
    notes = [
        "NOTAS:",
        "1. Cotas en metros, salvo indicación.",
        "2. Traslapes y anclajes según E.060.",
        "3. Verificar medidas en obra.",
    ]
    pedestal = cutoff_length(plan.cutoffs, "pedestal")
    if pedestal > 0:
        notes.append(f"4. Longitud de pedestal: {fixed(pedestal)} m.")
    for index, note in enumerate(notes):
        place = Point(origin.x, after_specs - (10 + index * 6) * unit)
        sheet.text(TEXTO, place, type_size.BODY, note)
