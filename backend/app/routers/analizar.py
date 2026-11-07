import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.transcribe import transcribir_audio
from app.services.muletillas import analizar_muletillas
from app.services.llm import evaluar_contenido
from app.services.reporte import generar_reporte


router = APIRouter(
    prefix="/analizar",
    tags=["Análisis de exposiciones"]
)

logger = logging.getLogger(__name__)

MAX_AUDIO_SIZE = 25 * 1024 * 1024


@router.post("/")
async def analizar_exposicion(
    audio: UploadFile = File(...),
    contexto: str = Form(default=""),
    eventos_cliente: str = Form(default="[]")
):
    """
    Procesa una exposición de principio a fin:

    1. Recibe y valida el audio.
    2. Transcribe el audio.
    3. Detecta las muletillas.
    4. Evalúa el contenido mediante IA.
    5. Genera el reporte final.
    """

    try:
        # 1. Validar archivo
        if not audio.filename:
            raise HTTPException(
                status_code=400,
                detail="No se ha enviado un archivo de audio."
            )

        content_type = (audio.content_type or "").lower()

        if not (
            content_type.startswith("audio/")
            or content_type == "video/webm"
            or content_type == "application/octet-stream"
        ):
            raise HTTPException(
                status_code=415,
                detail="El formato del archivo no es compatible."
            )

        # 2. Leer y validar audio
        contenido_audio = await audio.read(MAX_AUDIO_SIZE + 1)

        if not contenido_audio:
            raise HTTPException(
                status_code=400,
                detail="El archivo de audio está vacío."
            )

        if len(contenido_audio) > MAX_AUDIO_SIZE:
            raise HTTPException(
                status_code=413,
                detail="El audio supera el límite de 25 MB."
            )

        # 3. Validar eventos del frontend
        try:
            eventos = json.loads(eventos_cliente)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Los eventos del cliente deben tener JSON válido."
            )

        if not isinstance(eventos, (list, dict)):
            raise HTTPException(
                status_code=400,
                detail="Los eventos deben ser una lista o un objeto JSON."
            )

        # 4. Transcribir audio
        try:
            resultado_transcripcion = await transcribir_audio(
                audio_bytes=contenido_audio,
                filename=audio.filename,
                content_type=content_type
            )

        except (ValueError, FileNotFoundError) as error:
            logger.error("Error de configuración de transcripción: %s", error)
            raise HTTPException(
                status_code=503,
                detail="El servicio de transcripción no está configurado correctamente."
            )

        except Exception as error:
            logger.exception("Error durante la transcripción.")
            raise HTTPException(
                status_code=502,
                detail="No fue posible transcribir el audio."
            )

        transcripcion = resultado_transcripcion.get("texto", "")

        if not transcripcion.strip():
            raise HTTPException(
                status_code=422,
                detail="No se pudo obtener texto del audio."
            )

        # 5. Analizar muletillas
        try:
            resultado_muletillas = analizar_muletillas(
                transcripcion
            )
        except Exception:
            logger.exception("Error analizando las muletillas.")
            raise HTTPException(
                status_code=500,
                detail="No fue posible analizar las muletillas."
            )

        # 6. Evaluar contenido mediante IA
        try:
            evaluacion = await evaluar_contenido(
                transcripcion=transcripcion,
                contexto=contexto
            )

        except (ValueError, FileNotFoundError) as error:
            logger.error("Error de configuración de evaluación: %s", error)
            raise HTTPException(
                status_code=503,
                detail="El servicio de evaluación no está configurado correctamente."
            )

        except Exception:
            logger.exception("Error durante la evaluación de IA.")
            raise HTTPException(
                status_code=502,
                detail="No fue posible evaluar el contenido de la exposición."
            )

        # 7. Generar reporte consolidado
        try:
            reporte = generar_reporte(
                transcripcion=transcripcion,
                evaluacion=evaluacion,
                muletillas=resultado_muletillas,
                duracion_segundos=0
            )

        except Exception:
            logger.exception("Error generando el reporte.")
            raise HTTPException(
                status_code=500,
                detail="No fue posible generar el reporte final."
            )

        # 8. Respuesta completa para el frontend
        return {
            "estado": "completado",
            "mensaje": "La exposición fue analizada correctamente.",
            "analisis_completado": True,

            "datos": {
                "nombre_archivo": audio.filename,
                "tipo_audio": content_type,
                "tamano_bytes": len(contenido_audio),
                "contexto": contexto,
                "eventos_cliente": eventos
            },

            "transcripcion": {
                "texto": transcripcion,
                "modelo": resultado_transcripcion.get("modelo"),
                "estado": resultado_transcripcion.get("estado")
            },

            "muletillas": resultado_muletillas,

            "evaluacion": evaluacion,

            "reporte": reporte
        }

    except HTTPException:
        raise

    except Exception:
        logger.exception("Error inesperado en el análisis.")
        raise HTTPException(
            status_code=500,
            detail="Ocurrió un error interno al analizar la exposición."
        )

    finally:
        await audio.close()