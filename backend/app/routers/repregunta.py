import json
import logging
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from app.services.transcribe import transcribir_audio
from app.services.llm import generar_textos, LimiteTemporalIA

router = APIRouter(prefix="/repregunta", tags=["Repreguntas"])


@router.post("")
async def repreguntar(audio: UploadFile = File(...), pregunta: str = Form(...), contexto: str = Form(...)):
    try:
        try:
            datos = json.loads(contexto)
            if not isinstance(datos, dict):
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(400, "El contexto debe ser un objeto JSON válido.")
        contenido = await audio.read(25 * 1024 * 1024 + 1)
        if not contenido:
            raise HTTPException(400, "El audio está vacío.")
        if len(contenido) > 25 * 1024 * 1024:
            raise HTTPException(413, "El audio supera el límite de 25 MB.")
        transcripcion = await transcribir_audio(contenido, audio.filename or "respuesta.webm", audio.content_type or "audio/webm")
        texto = transcripcion["texto"]
        if not texto.strip():
            raise HTTPException(422, "No se pudo obtener texto de la respuesta.")
        textos = await generar_textos("Genera una sola repregunta que profundice en la respuesta del estudiante.",
                                     {"pregunta": pregunta, "respuesta": texto, "contexto": datos}, 1, "repregunta.md")
        return {"transcripcion_respuesta": texto, "repregunta": textos[0]}
    except HTTPException:
        raise
    except LimiteTemporalIA as error:
        raise HTTPException(429, str(error))
    except ValueError:
        raise HTTPException(503, "Revisa la configuración de IA del backend.")
    except Exception:
        logging.exception("Error generando repregunta")
        raise HTTPException(502, "No fue posible generar la repregunta.")
    finally:
        await audio.close()
