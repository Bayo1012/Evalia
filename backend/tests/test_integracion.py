import io
import json
import unittest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from starlette.datastructures import UploadFile, Headers
from app.routers.analizar import analizar_exposicion
from app.routers.repregunta import repreguntar


class Integracion(unittest.IsolatedAsyncioTestCase):
    def audio(self):
        return UploadFile(io.BytesIO(b'audio'), filename='ensayo.webm',
                          headers=Headers({'content-type': 'audio/webm'}))

    async def test_analisis_contrato_y_rubrica(self):
        for rubrica in ('', 'Explicar los resultados'):
            contexto = json.dumps({'presentacion': 'Tesis', 'jurado': 'curioso', 'rubrica': rubrica})
            with patch('app.routers.analizar.transcribir_audio', AsyncMock(return_value={
                'texto': 'bueno hola', 'duracion': 4,
                'palabras': [{'word': 'bueno', 'start': 0, 'end': 1}, {'word': 'hola', 'start': 1, 'end': 2}]
            })), patch('app.routers.analizar.evaluar_contenido', AsyncMock(return_value={
                'criterios': [{'puntaje': 15}] * 5
            })), patch('app.routers.analizar.generar_textos', AsyncMock(return_value=['uno', 'dos', 'tres'])) as generar:
                resultado = await analizar_exposicion(self.audio(), contexto, json.dumps([
                    {'t': 2, 'tipo': 'mirada_baja', 'origen': 'video', 'detalle': 'Mirada desviada'}]))
            llamada_reporte = next(c for c in generar.call_args_list if c.args[3] == 'reporte.md')
            self.assertEqual(llamada_reporte.args[1]['transcripcion'], 'bueno hola')
            self.assertEqual(llamada_reporte.args[1]['contexto']['rubrica'], rubrica)
            self.assertEqual(resultado['recomendaciones'], ['uno', 'dos', 'tres'])
            self.assertEqual(resultado['rubrica_usada'], 'personalizada' if rubrica else 'predeterminada')
            self.assertEqual(resultado['puntajes']['contenido'], 75)
            self.assertEqual(len(resultado['preguntas_jurado']), 3)
            self.assertEqual(resultado['duracion'], 4)
            self.assertTrue(any(e['tipo'] == 'muletilla' for e in resultado['eventos']))
            self.assertTrue(any(e['origen'] == 'video' for e in resultado['eventos']))

    async def test_respuesta_hablada(self):
        with patch('app.routers.repregunta.transcribir_audio', AsyncMock(return_value={'texto': 'Mi respuesta'})), patch(
            'app.routers.repregunta.generar_textos', AsyncMock(return_value=['¿Por qué?'])
        ):
            resultado = await repreguntar(self.audio(), '¿Cómo?', '{}')
        self.assertEqual(resultado, {'transcripcion_respuesta': 'Mi respuesta', 'repregunta': '¿Por qué?'})

    async def test_clave_ausente_indica_como_configurar(self):
        with patch('app.routers.analizar.transcribir_audio', AsyncMock(side_effect=ValueError('Falta configurar GROQ_API_KEY.'))):
            with self.assertRaises(HTTPException) as error:
                await analizar_exposicion(self.audio(), '{}', '[]')
        self.assertEqual(error.exception.status_code, 503)
        self.assertIn('GROQ_API_KEY en backend/.env', error.exception.detail)

    async def test_limite_del_jurado_se_devuelve_como_429(self):
        from app.services.llm import LimiteTemporalIA
        with patch('app.routers.analizar.transcribir_audio', AsyncMock(return_value={
            'texto': 'hola', 'duracion': 1, 'palabras': [{'word': 'hola', 'start': 0, 'end': 1}]
        })), patch('app.routers.analizar.evaluar_contenido', AsyncMock(return_value={
            'criterios': [{'puntaje': 15}] * 5
        })), patch('app.routers.analizar.generar_textos', AsyncMock(side_effect=LimiteTemporalIA('Espera y reintenta.'))):
            with self.assertRaises(HTTPException) as error:
                await analizar_exposicion(self.audio(), '{}', '[]')
        self.assertEqual(error.exception.status_code, 429)
        self.assertIn('Espera', error.exception.detail)
