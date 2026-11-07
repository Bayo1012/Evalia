import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

test('el adaptador registrado graba solo audio y libera el análisis al detener', async ({ page }) => {
  await page.goto('/');
  const resultado = await page.evaluate(async () => {
    const ruta = '/src/integrations/audio.ts';
    const { obtenerAdaptadorAudio } = await import(/* @vite-ignore */ ruta);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const metricas: number[] = [];
    const sesion = await obtenerAdaptadorAudio().iniciar(stream, (m: {volumen: number}) => metricas.push(m.volumen));
    await new Promise(resolve => setTimeout(resolve, 1100));
    const { audio } = await sesion.detener();
    const local = stream.getVideoTracks()[0].readyState;
    stream.getTracks().forEach(t => t.stop());
    return { size: audio.size, tipo: audio.type, mediciones: metricas.length, local };
  });
  expect(resultado.size).toBeGreaterThan(0);
  expect(resultado.tipo).toContain('audio/');
  expect(resultado.mediciones).toBeGreaterThan(0);
  expect(resultado.local).toBe('live');
});
