import pytest
from pydantic import ValidationError

from app.api.schemas.wall_plan import WallPlanRequest
from app.config import Settings


def errors_of(payload: dict) -> list[dict]:
    with pytest.raises(ValidationError) as error:
        WallPlanRequest.model_validate(payload)
    return error.value.errors()


def test_sample_is_valid(sample):
    plan = WallPlanRequest.model_validate(sample)
    assert plan.geo.base == pytest.approx(5.7)
    assert plan.materials.recubrimientoZapata == 7.5
    assert plan.project.lamina == "E-1"


def test_wall_without_key(sample):
    sample["geo"].update(keyDepth=0, keyTop=0, keyBottom=0, keyX=0)
    assert WallPlanRequest.model_validate(sample).geo.keyDepth == 0


@pytest.mark.parametrize("element", ["pantalla", "punta", "talon", "key"])
def test_steel_element_may_be_null(sample, element):
    sample["steel"][element] = None
    assert getattr(WallPlanRequest.model_validate(sample).steel, element) is None


def test_steel_row_may_be_null(sample):
    sample["steel"]["pantalla"]["principal"] = None
    assert WallPlanRequest.model_validate(sample).steel.pantalla.principal is None


def test_steel_and_cutoffs_are_optional(sample):
    del sample["steel"], sample["cutoffs"]
    plan = WallPlanRequest.model_validate(sample)
    assert plan.steel.pantalla is None and plan.cutoffs is None


def test_key_needs_width(sample):
    sample["geo"]["keyTop"] = 0
    assert errors_of(sample)[0]["ctx"]["fields"] == ["geo.keyTop"]


def test_key_bottom_cannot_exceed_top(sample):
    sample["geo"]["keyBottom"] = 2
    assert "geo.keyBottom" in errors_of(sample)[0]["ctx"]["fields"]


def test_key_must_stay_on_base(sample):
    sample["geo"]["keyX"] = 6
    assert errors_of(sample)[0]["ctx"]["fields"] == ["geo.keyX"]


def test_front_cannot_exceed_wall(sample):
    sample["geo"]["front"] = 8
    assert errors_of(sample)[0]["ctx"]["fields"] == ["geo.front"]


@pytest.mark.parametrize("value", ["6.65", None, True, float("nan"), float("inf"), 0, -1, 101])
def test_rejects_invalid_stem(sample, value):
    sample["geo"]["stem"] = value
    assert errors_of(sample)[0]["loc"] == ("geo", "stem")


def test_rejects_legacy_cell_names_in_geo(sample):
    sample["geo"]["B18"] = 6.4
    assert errors_of(sample)[0]["type"] == "extra_forbidden"


def test_rejects_legacy_contract():
    missing = {error["loc"] for error in errors_of({"predim": {"inputValues": {"B18": 6.4}}})}
    assert missing == {("geo",), ("materials",)}


def test_project_accepts_extra_fields_blanks_and_numbers(sample):
    sample["project"].update(extra="ignorado", codigo=32478, ingeniero=None, cliente="")
    project = WallPlanRequest.model_validate(sample).project
    assert (project.codigo, project.ingeniero, project.cliente) == ("32478", "-", "-")


@pytest.mark.parametrize(("value", "expected"), [("20", 20), (15, 15), (0, None), ("", None), (None, None)])
def test_spacing_accepts_what_the_sheet_sends(sample, value, expected):
    sample["steel"]["pantalla"]["principal"]["spacing"] = value
    assert WallPlanRequest.model_validate(sample).steel.pantalla.principal.spacing == expected


def test_steel_label_fits_the_table(sample):
    sample["steel"]["pantalla"]["principal"]["label"] = "x" * 41
    assert errors_of(sample)[0]["loc"] == ("steel", "pantalla", "principal", "label")


def test_project_text_has_a_limit(sample):
    sample["project"]["proyecto"] = "x" * 301
    assert errors_of(sample)[0]["loc"] == ("project", "proyecto")


def test_settings_require_a_strong_token(monkeypatch):
    monkeypatch.delenv("API_TOKEN", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, api_token="corto")


def test_settings_split_cors_origins(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example, https://b.example")
    settings = Settings(_env_file=None, api_token="t" * 40)
    assert settings.cors_origins == ["https://a.example", "https://b.example"]
