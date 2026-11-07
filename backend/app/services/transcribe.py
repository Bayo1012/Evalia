import os
from io import BytesIO

from openai import AsyncOpenAI, OpenAIError


MODEL = "whisper-large-v3-turbo"
BASE_URL = "https://api.groq.com/openai/v1"


async def transcribir_audio(
    audio_bytes: bytes,
    filename: str,
    content_type: str = "audio/ogg"
) -> dict:

    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key:
        raise ValueError("Falta configurar GROQ_API_KEY.")

    if not audio_bytes:
        raise ValueError("El audio está vacío.")

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=BASE_URL,
        timeout=45.0,
        max_retries=0,
        default_headers={
            "Accept-Encoding": "identity"
        }
    )

    try:
        archivo = (
            filename,
            BytesIO(audio_bytes),
            content_type
        )

        respuesta = await client.audio.transcriptions.create(
            model=MODEL,
            file=archivo,
            response_format="verbose_json",
            timestamp_granularities=["word"],
            language="es"
        )

        return {
            "texto": respuesta.text,
            "duracion": getattr(respuesta, "duration", 0) or 0,
            "palabras": [dict(w) if isinstance(w, dict) else w.model_dump() for w in (getattr(respuesta, "words", None) or [])],
            "modelo": MODEL,
            "estado": "completado"
        }

    except OpenAIError as error:
        raise RuntimeError(
            f"Error de transcripción en Groq: {error}"
        ) from error

    finally:
        await client.close()