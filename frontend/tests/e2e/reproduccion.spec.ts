import { test, expect } from '@playwright/test';
import { analisisDemo } from '../../src/api/demo';

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

for (const modo of ['normal', 'sin-duracion', 'primer-cuadro', 'error-recuperable']) {
const duracionDesconocida = modo === 'sin-duracion';
test(`reproducción del reporte: ${modo}`, async ({ page }) => {
  let analisis = 0;
  if (modo === 'primer-cuadro') await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState')!;
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get() {
      const estado = original.get!.call(this);
      return this.src?.startsWith('blob:') ? Math.min(2, estado) : estado;
    }});
  });
  if (modo === 'error-recuperable') await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      if (sessionStorage.getItem('video-recuperado') !== 'si' && blob instanceof Blob && blob.type.startsWith('video/')) {
        return original(new Blob(['archivo invalido'], {type: 'video/webm'}));
      }
      return original(blob);
    };
  });
  if (duracionDesconocida) await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration')!;
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', { configurable: true, get() {
      return this.src?.startsWith('blob:') ? Infinity : original.get!.call(this);
    }});
  });
  await page.route('**/src/analysis/video/mediapipe.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function cargarModelos(){throw new Error('Sin modelo en esta prueba');} export function cerrarModelos(){}`,
  }));
  await page.route('**/api/analizar', async route => {
    analisis++;
    const datos = route.request().postDataBuffer()!.toString('latin1');
    expect(datos).toContain('name="audio"');
    expect(datos).not.toContain('name="video"');
    expect(datos).not.toContain('Content-Type: video/');
    await route.fulfill({ json: { ...analisisDemo, duracion: 3,
      recomendaciones: ['Explica tu hipótesis: Desarrolla la hipótesis que mencionaste sobre el aprendizaje.', 'Sustenta tu comparación: Agrega evidencia al comparar los resultados.', 'Precisa tu cierre: Retoma el objetivo que anunciaste.'],
      eventos: [{ t: 1, tipo: 'pausa_larga', origen: 'audio', detalle: 'Revisar este momento' }] } });
  });
  await page.goto('/');
  await expect(page.getByText('Modo real', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Demostración', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ensayo real', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Activar cámara y micrófono' }).click();
  await page.getByRole('button', { name: 'Continuar sin análisis de video' }).click();
  await page.getByRole('button', { name: 'Comenzar ensayo' }).click();
  await page.getByRole('button', { name: 'Iniciar grabación real' }).click();
  await expect(page.getByRole('button', { name: 'Detener grabación', exact: true })).toBeVisible();
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: 'Detener grabación', exact: true }).click();
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByText('Grabación lista para analizar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Analizar ensayo', exact: true }).click();
  const video = page.getByLabel('Grabación de tu ensayo', { exact: true });
  await expect(video).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.loading-screen')).toHaveCount(0, { timeout: 25_000 });
  if (modo === 'error-recuperable') {
    await expect(page.getByRole('button', { name: 'Reintentar reproducción', exact: true })).toBeVisible();
    await page.evaluate(() => sessionStorage.setItem('video-recuperado', 'si'));
    await page.getByRole('button', { name: 'Reintentar reproducción', exact: true }).click();
    await expect(page.locator('.loading-screen')).toHaveCount(0, { timeout: 25_000 });
  }
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
  expect(analisis).toBe(1);
  if (duracionDesconocida) expect(await video.evaluate((v: HTMLVideoElement) => v.duration)).toBe(Infinity);
  await expect(page.locator('.recommendations h3').first()).toHaveText('Explica tu hipótesis');
  await expect(page.locator('.recommendations')).toContainText('Desarrolla la hipótesis que mencionaste');
  await expect(page.getByText('Conecta con tu audiencia', { exact: true })).toHaveCount(0);
  await page.locator('.timeline-events button').click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(1);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
});

}
