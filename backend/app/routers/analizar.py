import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.transcribe import transcribir_audio
from app.services.muletillas import analizar_muletillas
from app.services.llm import evaluar_contenido, generar_textos, cargar_prompt, LimiteTemporalIA
from app.services.reporte import generar_reporte


router = APIRouter(
    prefix="/analizar",
    tags=["Análisis de exposiciones"]
)

logger = logging.getLogger(__name__)

MAX_AUDIO_SIZE = 25 * 1024 * 1024


def resumir_eventos(eventos: list[dict]) -> list[dict]:
    """Resumen para IA; la línea de tiempo conserva todos los eventos originales."""
    grupos = {}
    for evento in eventos:
        clave = (evento["tipo"], evento["origen"])
        if clave not in grupos:
            grupos[clave] = {**evento, "cantidad": 0}
        grupos[clave]["cantidad"] += 1
    return list(grupos.values())


@router.post("")
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

        try:
            datos_contexto = json.loads(contexto or "{}")
            if not isinstance(datos_contexto, dict) or not isinstance(eventos, list):
                raise ValueError()
            perfil = datos_contexto.get("jurado", "exigente")
            if perfil not in ("exigente", "curioso", "formal", "publico_general"):
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(400, "Contexto o eventos inválidos.")

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
                detail="Falta configurar GROQ_API_KEY en backend/.env. Guarda tu clave y reinicia el backend."
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

        except LimiteTemporalIA as error:
            raise HTTPException(429, str(error))

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

        # Adaptar los resultados existentes al contrato consumido por el frontend.
        palabras = [
            {"palabra": w["word"], "inicio": w["start"], "fin": w["end"]}
            for w in resultado_transcripcion.get("palabras", [])
        ]
        duracion = max(float(resultado_transcripcion.get("duracion", 0)),
                       max((w["fin"] for w in palabras), default=0),
                       max((e.get("t", 0) for e in eventos), default=0))
        if not palabras:
            raise HTTPException(502, "La transcripción no devolvió tiempos por palabra.")
        from app.services.muletillas import normalizar_texto
        import re
        posiciones = list(re.finditer(r"\S+", normalizar_texto(transcripcion)))
        for hallazgo in resultado_muletillas.get("detalle", []):
            indice = next((i for i, m in enumerate(posiciones) if m.start() <= hallazgo["posicion"] < m.end()), 0)
            t = palabras[min(indice, len(palabras) - 1)]["inicio"]
            eventos.append({"t": t, "tipo": "muletilla", "origen": "transcripcion", "detalle": hallazgo["muletilla"]})
        ritmo = len(palabras) * 60 / duracion if duracion else 0
        if ritmo > 180 or 0 < ritmo < 90:
            eventos.append({"t": 0, "tipo": "ritmo_rapido" if ritmo > 180 else "ritmo_lento",
                            "origen": "transcripcion", "detalle": f"{ritmo:.0f} palabras/min"})
        voz = max(0, 100 - 4 * sum(e["origen"] != "video" for e in eventos))
        cuerpo = max(0, 100 - 5 * sum(e["origen"] == "video" for e in eventos))
        contenido = reporte["resumen"]["puntaje_total"]
        rubrica = datos_contexto.get("rubrica", "").strip()
        datos_ia = {"transcripcion": transcripcion, "contexto": datos_contexto,
                   "rubrica": rubrica or cargar_prompt("rubrica_predeterminada.md"),
                   "evaluacion": {k: evaluacion.get(k) for k in ("fortalezas", "aspectos_mejorar", "observacion_general")},
                   "eventos": resumir_eventos(eventos)}
        try:
            # Evitar ráfagas de tokens contra la cuota compartida del proveedor.
            preguntas = await generar_textos(
                f"Genera exactamente tres preguntas de jurado con perfil {perfil} sobre esta exposición.",
                datos_ia, 3, f"jurado_{perfil}.md")
            recomendaciones = await generar_textos(
                "Genera exactamente tres recomendaciones prácticas basadas en los hallazgos.",
                datos_ia, 3, "reporte.md")
        except LimiteTemporalIA as error:
            raise HTTPException(429, str(error))
        except Exception:
            logger.exception("Error generando jurado y recomendaciones")
            raise HTTPException(502, "No fue posible generar las preguntas y recomendaciones.")
        return {
            "duracion": duracion,
            "rubrica_usada": "personalizada" if rubrica else "predeterminada",
            "puntajes": {"voz": voz, "cuerpo": cuerpo, "contenido": contenido,
                         "total": round((voz + cuerpo + contenido) / 3)},
            "eventos": sorted(eventos, key=lambda e: e["t"]),
            "transcripcion": palabras,
            "recomendaciones": recomendaciones,
            "preguntas_jurado": preguntas,
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