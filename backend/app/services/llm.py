import os
import json
from pathlib import Path

from openai import AsyncOpenAI, OpenAIError

PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"

MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-20b"
)

ESQUEMA_EVALUACION = {
    "type": "object",
    "properties": {
        "criterios": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "nombre": {"type": "string"},
                    "puntaje": {"type": "integer"},
                    "justificacion": {"type": "string"}
                },
                "required": [
                    "nombre",
                    "puntaje",
                    "justificacion"
                ],
                "additionalProperties": False
            }
        },
        "fortalezas": {
            "type": "array",
            "items": {"type": "string"}
        },
        "aspectos_mejorar": {
            "type": "array",
            "items": {"type": "string"}
        },
        "observacion_general": {
            "type": "string"
        },
        "limitaciones": {
            "type": "string"
        }
    },
    "required": [
        "criterios",
        "fortalezas",
        "aspectos_mejorar",
        "observacion_general",
        "limitaciones"
    ],
    "additionalProperties": False
}

def cargar_prompt(nombre: str) -> str:
    """
    Lee un archivo de instrucciones de la carpeta prompts.
    """

    ruta = PROMPTS_DIR / nombre

    if not ruta.exists():
        raise FileNotFoundError(
            f"No se encontró el prompt: {nombre}"
        )

    contenido = ruta.read_text(encoding="utf-8").strip()

    if not contenido:
        raise ValueError(
            f"El prompt {nombre} está vacío."
        )

    return contenido


async def evaluar_contenido(
    transcripcion: str,
    contexto: str = ""
) -> dict:
    """
    Evalúa el contenido de una exposición utilizando OpenAI.
    """

    if not isinstance(transcripcion, str) or not transcripcion.strip():
        raise ValueError(
            "La transcripción no puede estar vacía."
        )

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise ValueError(
            "No se encontró la variable OPENAI_API_KEY."
        )

    instrucciones = cargar_prompt("evaluador_contenido.md")
    rubrica = cargar_prompt("rubrica_predeterminada.md")

    instrucciones_completas = f"""
{instrucciones}

RÚBRICA DE EVALUACIÓN:

{rubrica}

Debes devolver exclusivamente una evaluación estructurada
que cumpla el esquema JSON solicitado.
"""

    entrada = f"""
CONTEXTO DE LA EXPOSICIÓN:

{contexto if contexto.strip() else "No se proporcionó contexto."}

TRANSCRIPCIÓN:

{transcripcion}
"""

    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
        default_headers={
            "Accept-Encoding": "identity"
        }
    )

    try:
        respuesta = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": instrucciones_completas
                },
                {
                    "role": "user",
                    "content": entrada
                }
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "evaluacion_exposicion",
                    "strict": True,
                    "schema": ESQUEMA_EVALUACION
                }
            }
        )

        contenido = respuesta.choices[0].message.content

        if not contenido:
            raise RuntimeError("Groq no devolvió una evaluación.")

        resultado = json.loads(contenido)

        criterios = resultado["criterios"]

        if len(criterios) != 5:
            raise RuntimeError(
                "La evaluación debe contener cinco criterios."
            )

        for criterio in criterios:
            puntaje = criterio["puntaje"]

            if not isinstance(puntaje, int) or not 0 <= puntaje <= 20:
                raise RuntimeError(
                    "Se recibió una puntuación fuera del rango permitido."
                )

        resultado["puntaje_total"] = sum(
            criterio["puntaje"] for criterio in criterios
        )

        resultado["puntaje_maximo"] = 100

        return resultado

    except OpenAIError as error:
        raise RuntimeError(
            f"Error de comunicación con OpenAI: {error}"
        ) from error

    finally:
        await client.close()