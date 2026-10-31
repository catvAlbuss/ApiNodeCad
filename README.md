# API CAD

Genera, a partir de un JSON, el plano DXF de un muro de contención en voladizo en lámina A1. Dibuja lo que recibe: no calcula ingeniería ni guarda datos.

## Desarrollo

Requiere Python 3.13.

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Linux y macOS: .venv/bin/python
cp .env.example .env.python                                    # Completar API_TOKEN (32 caracteres o más)
.venv/Scripts/uvicorn --factory app.main:create_app --reload
```

Pruebas y estilo:

```bash
.venv/Scripts/python -m pytest
.venv/Scripts/ruff check .
```

Con Docker:

```bash
docker build -t api-cad .
docker run --rm -p 8000:8000 -m 512m -e API_TOKEN=<token> api-cad
```

## Uso

```bash
curl -X POST http://localhost:8000/api/v1/planos/muro-contencion \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data-binary @tests/fixtures/muro-7.4m.json \
  -o plano.dxf
```

| Ruta | Descripción |
|---|---|
| `POST /api/v1/planos/muro-contencion` | Devuelve el DXF. Requiere el token. |
| `GET /health` | Estado y versión. |

Errores con formato único:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "geo.stem debe ser mayor que 0", "fields": ["geo.stem"] } }
```

Códigos: `400` validación, `401` token, `413` tamaño, `429` límite de uso, `500` interno.

El token es de servicio: lo envía el backend y nunca debe llegar al navegador.

## El plano

- Lámina A1 en espacio papel, con una ventana a escala exacta. Escala automática entre 1:25 y 1:150.
- Modelo en metros a tamaño real; texto y cotas definidos en mm de papel.
- Cotas `DIMENSION`, tramas `HATCH` y membrete como bloque con atributos editables.
- Capas: `MARCO`, `MEMBRETE`, `CONCRETO`, `TERRENO`, `ACERO_PRINCIPAL`, `ACERO_SECUNDARIO`, `COTAS` y `TEXTO`.

## Estructura

Dependencias en un solo sentido: `api → domain/drawing → render`.

```text
app/
├── main.py        Aplicación y middlewares
├── config.py      Configuración por entorno
├── generation.py  Orquesta la generación con tiempo máximo
├── api/           Rutas, contrato, errores y middlewares
├── domain/        Geometría del muro, barras y escala
├── drawing/       Entidades abstractas, vistas y lámina
├── render/        Escritor DXF, único módulo que conoce ezdxf
└── standards/     Capas, tipografía y tramas
```

## Despliegue

`render.yaml` define el servicio Docker en Render. La variable `API_TOKEN` se genera allí; el backend debe usar el mismo valor.
