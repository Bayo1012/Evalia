import copy
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from openai import BadRequestError
from app.services.llm import evaluar_contenido


VALIDA = {
    'criterios': [{'nombre': 'Claridad', 'puntaje': 15, 'justificacion': 'Evidencia'} for _ in range(5)],
    'fortalezas': ['Objetivo definido'], 'aspectos_mejorar': ['Sustentar el argumento'],
    'observacion_general': 'Presenta un objetivo claro.', 'limitaciones': '',
}


def respuesta(datos):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(datos)))])


def error_proveedor(mensaje, codigo):
    return BadRequestError(mensaje, response=SimpleNamespace(
        request=SimpleNamespace(), status_code=400, headers={}),
        body={'error': {'code': codigo, 'message': mensaje}})


class Evaluador(unittest.IsolatedAsyncioTestCase):
    async def ejecutar(self, efectos):
        cliente = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
            create=AsyncMock(side_effect=efectos))), close=AsyncMock())
        with patch.dict('os.environ', {'GROQ_API_KEY': 'clave-de-prueba'}), patch(
                'app.services.llm.AsyncOpenAI', return_value=cliente):
            resultado = await evaluar_contenido('Mi objetivo es explicar el aprendizaje.')
        cliente.close.assert_awaited_once()
        return resultado, cliente.chat.completions.create

    async def test_evaluacion_valida_no_se_repite(self):
        resultado, llamada = await self.ejecutar([respuesta(VALIDA)])
        self.assertEqual(resultado['puntaje_total'], 75)
        self.assertEqual(llamada.await_count, 1)
        self.assertIn('observacion_general', llamada.call_args.kwargs['messages'][0]['content'])

    async def test_recupera_error_de_esquema_del_proveedor(self):
        error = error_proveedor('Generated JSON does not match the expected schema', 'json_validate_failed')
        resultado, llamada = await self.ejecutar([error, respuesta(VALIDA)])
        self.assertEqual(resultado['limitaciones'], '')
        self.assertEqual(llamada.await_count, 2)
        self.assertIn('limitaciones', llamada.call_args.kwargs['messages'][-1]['content'])

    async def test_reintenta_campos_omitidos_y_puntajes_invalidos(self):
        casos = []
        incompleta = copy.deepcopy(VALIDA)
        del incompleta['limitaciones']
        casos.append(incompleta)
        invalida = copy.deepcopy(VALIDA)
        invalida['criterios'][0]['puntaje'] = 25
        casos.append(invalida)
        for datos in casos:
            with self.subTest(datos=datos):
                resultado, llamada = await self.ejecutar([respuesta(datos), respuesta(VALIDA)])
                self.assertEqual(llamada.await_count, 2)
                self.assertEqual(resultado['puntaje_total'], 75)

    async def test_no_reintenta_otros_errores_del_proveedor(self):
        with self.assertRaisesRegex(RuntimeError, 'Groq'):
            await self.ejecutar([error_proveedor('Invalid API request', 'invalid_request_error')])

    async def test_no_reintenta_indefinidamente_ni_inventa_evaluacion(self):
        with self.assertRaisesRegex(RuntimeError, 'formato requerido'):
            await self.ejecutar([respuesta({}), respuesta({})])


class LimitesProveedor(unittest.IsolatedAsyncioTestCase):
    def error(self, mensaje='Please try again in 2.55s.', headers=None, codigo='rate_limit_exceeded'):
        from openai import RateLimitError
        return RateLimitError(mensaje, response=SimpleNamespace(
            request=SimpleNamespace(), status_code=429, headers=headers or {}),
            body={'error': {'code': codigo}})

    async def test_espera_y_reintenta_solo_la_llamada_limitada(self):
        from app.services.llm import completar_chat
        crear = AsyncMock(side_effect=[self.error(), respuesta({'textos': ['listo']})])
        cliente = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=crear)))
        with patch('app.services.llm.asyncio.sleep', new_callable=AsyncMock) as dormir:
            resultado = await completar_chat(cliente, model='modelo', messages=[])
        dormir.assert_awaited_once_with(3.05)
        self.assertEqual(crear.await_count, 2)
        self.assertEqual(json.loads(resultado.choices[0].message.content)['textos'], ['listo'])
        self.assertEqual(crear.call_args.kwargs['max_completion_tokens'], 1800)

    async def test_respeta_retry_after(self):
        from app.services.llm import espera_limite
        self.assertEqual(espera_limite(self.error(headers={'retry-after': '4'})), 4.5)

    async def test_no_reintenta_cuotas_agotadas_ni_esperas_largas(self):
        from app.services.llm import completar_chat, LimiteTemporalIA
        for error in [self.error(codigo='insufficient_quota'), self.error('Please try again in 3600s.')]:
            crear = AsyncMock(side_effect=error)
            cliente = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=crear)))
            with patch('app.services.llm.asyncio.sleep', new_callable=AsyncMock) as dormir:
                with self.assertRaises(LimiteTemporalIA):
                    await completar_chat(cliente, model='modelo', messages=[])
            self.assertEqual(crear.await_count, 1)
            dormir.assert_not_awaited()

    async def test_limita_reintentos(self):
        from app.services.llm import completar_chat, LimiteTemporalIA
        crear = AsyncMock(side_effect=self.error())
        cliente = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=crear)))
        with patch('app.services.llm.asyncio.sleep', new_callable=AsyncMock) as dormir:
            with self.assertRaises(LimiteTemporalIA):
                await completar_chat(cliente, model='modelo', messages=[])
        self.assertEqual(crear.await_count, 3)
        self.assertEqual(dormir.await_count, 2)
