import io
from collections import Counter
from pathlib import Path

import ezdxf
import pytest
from ezdxf import bbox

from app.domain.sheet.scale import PAPER
from app.standards.layers import LAYERS
from tests.conftest import AUTH, URL


def generate(client, payload):
    response = client.post(URL, json=payload, headers=AUTH)
    assert response.status_code == 200, response.text
    return response


def parse(response):
    return ezdxf.read(io.StringIO(response.content.decode("utf-8")))


def paper(document):
    return document.layouts.get("A1")


def title_block(document):
    return paper(document).query("INSERT").first


def texts(document) -> list[str]:
    spaces = (document.modelspace(), paper(document), document.blocks.get("MEMBRETE_A1"))
    found = [entity.dxf.text for space in spaces for entity in space.query("TEXT")]
    found += [entity.dxf.text for entity in document.modelspace().query("DIMENSION")]
    return found + [attribute.dxf.text for attribute in title_block(document).attribs]


def plan_scale(document) -> int:
    return int(title_block(document).get_attrib_text("ESCALA").removeprefix("1:"))


def small_wall(payload):
    payload["geo"].update(punta=0.3, batter=0.1, crown=0.2, heel=0.5, hz=0.3, stem=1.2, rise=0, front=0.4)
    payload["geo"].update(keyDepth=0, keyTop=0, keyBottom=0, keyX=0)
    return payload


def tall_wall(payload):
    payload["geo"].update(punta=3, batter=1, crown=0.3, heel=6, hz=1.2, stem=16, keyX=3)
    return payload


def test_response_is_a_dxf_attachment(client, sample):
    response = generate(client, sample)
    assert response.headers["content-type"] == "application/dxf"
    assert response.headers["content-disposition"].startswith("attachment;")


def test_sample_passes_audit_at_scale_50_inside_frame(client, sample):
    document = parse(generate(client, sample))
    audit = document.audit()
    assert (audit.errors, audit.fixes) == ([], [])
    assert plan_scale(document) == 50
    extents = bbox.extents(document.modelspace())
    unit = 50 / 1000
    assert extents.extmin.x >= -1e-6 and extents.extmin.y >= -1e-6
    assert extents.extmax.x <= PAPER.width * unit + 1e-6
    assert extents.extmax.y <= PAPER.height * unit + 1e-6


def test_uses_only_standard_layers(client, sample):
    document = parse(generate(client, sample))
    used = {entity.dxf.layer for entity in document.modelspace()}
    used |= {entity.dxf.layer for entity in paper(document) if entity.dxftype() != "VIEWPORT"}
    assert used == set(LAYERS)


def test_layers_define_lineweight(client, sample):
    document = parse(generate(client, sample))
    assert all(document.layers.get(name).dxf.lineweight > 0 for name in LAYERS)


def test_concrete_and_soil_are_hatched(client, sample):
    model = parse(generate(client, sample)).modelspace()
    patterns = {hatch.dxf.pattern_name for hatch in model.query("HATCH")}
    assert patterns == {"AR-CONC", "EARTH"}


def test_dimensions_are_real_and_use_the_plan_style(client, sample):
    model = parse(generate(client, sample)).modelspace()
    dimensions = model.query("DIMENSION")
    assert len(dimensions) >= 15
    assert {dimension.dxf.dimstyle for dimension in dimensions} == {"COTA_PLANO"}
    assert {dimension.dxf.layer for dimension in dimensions} == {"COTAS"}
    assert "B = <>" in {dimension.dxf.text for dimension in dimensions}


def test_paper_space_has_an_exact_scale_viewport(client, sample):
    document = parse(generate(client, sample))
    layout = paper(document)
    viewports = [v for v in layout.query("VIEWPORT") if v.dxf.id > 1]
    assert len(viewports) == 1
    view = viewports[0]
    assert view.dxf.height / view.dxf.view_height == pytest.approx(1000 / plan_scale(document))
    assert view.dxf.layer == "Defpoints"
    assert (layout.dxf_layout.dxf.paper_width, layout.dxf_layout.dxf.paper_height) == (841, 594)
    assert document.layers.get("Defpoints").dxf.plot == 0
    frame = layout.query('LWPOLYLINE[layer=="MARCO"]')
    assert len(frame) == 2


def test_title_block_is_an_editable_block(client, sample):
    document = parse(generate(client, sample))
    block = title_block(document)
    assert block.dxf.name == "MEMBRETE_A1"
    assert block.get_attrib_text("PROYECTO_1") == "PROYECTO DE PRUEBA"
    assert block.get_attrib_text("LAMINA") == "E-1"
    assert block.get_attrib_text("CODIGO") == "00000"


@pytest.mark.parametrize(("shape", "expected"), [(small_wall, 25), (tall_wall, 100)])
def test_text_prints_at_three_mm_at_any_scale(client, sample, shape, expected):
    document = parse(generate(client, shape(sample)))
    scale = plan_scale(document)
    assert scale == expected
    model = Counter(round(t.dxf.height * 1000 / scale, 6) for t in document.modelspace().query("TEXT"))
    printed = Counter(round(t.dxf.height, 6) for t in paper(document).query("TEXT"))
    assert set(model) == {3, 4} and model[3] > 0
    assert set(printed) == {3, 4}
    style = document.dimstyles.get("COTA_PLANO")
    assert style.dxf.dimtxt == 3 and style.dxf.dimscale == pytest.approx(scale / 1000)
    extents = bbox.extents(document.modelspace())
    unit = scale / 1000
    assert extents.extmin.x >= -1e-6 and extents.extmin.y >= -1e-6
    assert extents.extmax.x <= PAPER.width * unit + 1e-6
    assert extents.extmax.y <= PAPER.height * unit + 1e-6


@pytest.mark.parametrize("shape", [lambda p: p, small_wall, tall_wall])
def test_views_stay_inside_frame_and_out_of_title_block(client, sample, shape):
    document = parse(generate(client, shape(sample)))
    unit = plan_scale(document) / 1000
    space = document.modelspace()
    drawing = bbox.extents(e for e in space if e.dxf.layer not in ("MARCO", "MEMBRETE"))
    assert drawing.extmin.x >= PAPER.left * unit
    assert drawing.extmin.y >= PAPER.margin * unit
    assert not space.query('*[layer=="MARCO" | layer=="MEMBRETE"]')
    assert drawing.extmax.x <= PAPER.block_x * unit
    assert drawing.extmax.y <= (PAPER.height - PAPER.margin) * unit


def test_wall_without_key(client, sample):
    sample["geo"].update(keyDepth=0, keyTop=0, keyBottom=0, keyX=0)
    assert parse(generate(client, sample)).audit().errors == []


def test_wall_without_steel_draws_dashes_and_invents_no_bars(client, sample):
    del sample["steel"], sample["cutoffs"]
    document = parse(generate(client, sample))
    assert document.audit().errors == []
    assert "-" in texts(document)
    assert not document.modelspace().query('CIRCLE[layer=="ACERO_SECUNDARIO"]')
    assert not document.modelspace().query('LINE[layer=="ACERO_SECUNDARIO"]')
    assert not document.modelspace().query('LINE[layer=="ACERO_PRINCIPAL"]')


def test_single_null_row(client, sample):
    sample["steel"]["pantalla"]["principal"] = None
    assert parse(generate(client, sample)).audit().errors == []


def test_mesh_bars_use_real_spacing(client, sample):
    sample["steel"]["pantalla"]["principal"]["spacing"] = 20  # 3 m / 20 cm = 15 barras
    sample["steel"]["pantalla"]["secundario"]["spacing"] = 10
    document = parse(generate(client, sample))
    vertical = document.modelspace().query('LINE[layer=="ACERO_PRINCIPAL"]')
    assert len(vertical) == 15 + 30


def test_covers_and_sheet_number_come_from_the_request(client, sample):
    sample["materials"]["recubrimientoZapata"] = 10
    sample["project"]["lamina"] = "E-7"
    found = texts(parse(generate(client, sample)))
    assert "10.0 cm" in found and "E-7" in found


def test_heel_cutoff_and_pedestal_are_drawn(client, sample):
    sample["cutoffs"]["pedestal"]["L"] = 0.5
    found = texts(parse(generate(client, sample)))
    assert found.count("Recorte <>") == 2
    assert "4. Longitud de pedestal: 0.50 m." in found


def test_symbols_accents_and_no_broken_values(client, sample):
    sample["project"]["ubicacion"] = "HUÁNUCO, PERÚ, 45°"
    response = generate(client, sample)
    content = response.content.decode("utf-8")
    found = texts(parse(response))
    assert "UBICACIÓN:" in found and "HUÁNUCO, PERÚ, 45%%d" in found
    assert "2 %%c 3/4 @ 20 cm" in found
    assert "Ø" not in content
    for broken in ("NaN", "undefined", "None", "�"):
        assert broken not in content


def test_wall_that_does_not_fit_is_a_400(client, sample):
    sample["geo"].update(heel=60, stem=90)
    response = client.post(URL, json=sample, headers=AUTH)
    assert response.status_code == 400
    assert response.json()["error"]["fields"] == ["geo"]


def test_leaves_no_files_behind(client, sample):
    root = Path.cwd()

    def snapshot():
        ignored = {".venv", ".git", "node_modules", "__pycache__", ".pytest_cache", ".ruff_cache"}
        return {p for p in root.rglob("*") if not ignored & set(p.parts)}

    before = snapshot()
    generate(client, sample)
    assert snapshot() == before
