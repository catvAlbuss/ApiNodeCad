"""Capas del plano: color ACI y grosor de línea en centésimas de milímetro."""

from typing import NamedTuple


class LayerStyle(NamedTuple):
    color: int
    lineweight: int


LAYERS = {
    "MARCO": LayerStyle(7, 50),
    "MEMBRETE": LayerStyle(7, 25),
    "CONCRETO": LayerStyle(7, 50),
    "TERRENO": LayerStyle(8, 18),
    "ACERO_PRINCIPAL": LayerStyle(1, 35),
    "ACERO_SECUNDARIO": LayerStyle(5, 25),
    "COTAS": LayerStyle(3, 13),
    "TEXTO": LayerStyle(7, 18),
}
