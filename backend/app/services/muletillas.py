import re
import unicodedata
from collections import Counter


MULETILLAS = [
    "o sea",
    "es decir",
    "por así decirlo",
    "digamos",
    "entonces",
    "básicamente",
    "literalmente",
    "bueno",
    "pues",
    "este",
    "eh",
    "em",
    "mmm",
    "um",
    "¿no?"
]


def normalizar_texto(texto: str) -> str:
    """
    Normaliza el texto para facilitar la detección.
    Conserva las palabras y elimina diferencias de mayúsculas.
    """
    texto = texto.lower()
    texto = unicodedata.normalize("NFC", texto)
    return texto


def analizar_muletillas(texto: str) -> dict:
    """
    Identifica y contabiliza las muletillas presentes
    en la transcripción de una exposición.
    """

    if not isinstance(texto, str):
        raise TypeError("El texto debe ser una cadena.")

    if not texto.strip():
        return {
            "total": 0,
            "cantidad_por_muletilla": {},
            "porcentaje": 0.0,
            "detalle": []
        }

    texto_normalizado = normalizar_texto(texto)

    resultados = []
    conteo = Counter()

    # Buscar cada muletilla mediante expresiones regulares
    for muletilla in sorted(MULETILLAS, key=len, reverse=True):

        patron = (
            r"(?<!\w)"
            + re.escape(muletilla)
            + r"(?!\w)"
        )

        coincidencias = list(
            re.finditer(patron, texto_normalizado)
        )

        if coincidencias:
            conteo[muletilla] = len(coincidencias)

            for coincidencia in coincidencias:
                resultados.append({
                    "muletilla": muletilla,
                    "posicion": coincidencia.start()
                })

    total = sum(conteo.values())

    palabras = re.findall(r"\b\w+\b", texto_normalizado)
    total_palabras = len(palabras)

    porcentaje = (
        round((total / total_palabras) * 100, 2)
        if total_palabras > 0 else 0.0
    )

    return {
        "total": total,
        "cantidad_por_muletilla": dict(conteo),
        "porcentaje": porcentaje,
        "total_palabras": total_palabras,
        "detalle": sorted(
            resultados,
            key=lambda x: x["posicion"]
        )
    }