from datetime import datetime, timezone


def generar_reporte(
    transcripcion: str,
    evaluacion: dict,
    muletillas: dict,
    duracion_segundos: float = 0
) -> dict:
    """
    Consolida los resultados de la exposición
    y genera el reporte final de Evalia.
    """

    # 1. Validar información recibida
    if not isinstance(transcripcion, str):
        raise TypeError("La transcripción debe ser texto.")

    if not isinstance(evaluacion, dict):
        raise TypeError("La evaluación debe ser un diccionario.")

    if not isinstance(muletillas, dict):
        raise TypeError("El análisis de muletillas debe ser un diccionario.")

    # 2. Obtener criterios de evaluación
    criterios = evaluacion.get("criterios", [])

    if len(criterios) != 5:
        raise ValueError(
            "La evaluación debe contener cinco criterios."
        )

    # 3. Calcular puntaje total
    puntaje_total = sum(
        criterio["puntaje"] for criterio in criterios
    )

    if any(
        not isinstance(c["puntaje"], int)
        or not 0 <= c["puntaje"] <= 20
        for c in criterios
    ):
        raise ValueError("Existen puntuaciones inválidas.")

    # 4. Obtener fortalezas y aspectos por mejorar
    fortalezas = evaluacion.get("fortalezas", [])
    aspectos_mejorar = evaluacion.get("aspectos_mejorar", [])

    # 5. Organizar el reporte
    reporte = {
        "estado": "completado",
        "fecha_generacion": datetime.now(
            timezone.utc
        ).isoformat(),

        "resumen": {
            "puntaje_total": puntaje_total,
            "puntaje_maximo": 100,
            "porcentaje": puntaje_total,
            "duracion_segundos": duracion_segundos
        },

        "evaluacion": {
            "criterios": criterios,
            "fortalezas": fortalezas,
            "aspectos_mejorar": aspectos_mejorar,
            "observacion_general": evaluacion.get(
                "observacion_general", ""
            ),
            "limitaciones": evaluacion.get(
                "limitaciones", ""
            )
        },

        "analisis_oral": {
            "total_muletillas": muletillas.get("total", 0),
            "cantidad_por_muletilla": muletillas.get(
                "cantidad_por_muletilla", {}
            ),
            "porcentaje_muletillas": muletillas.get(
                "porcentaje", 0
            )
        },

        "transcripcion": transcripcion
    }

    return reporte