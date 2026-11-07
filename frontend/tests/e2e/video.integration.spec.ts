import { test, expect, type Page } from '@playwright/test';

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

interface PruebaVideo {
  streams: MediaStream[];
  inicios: number;
  cancelaciones: number;
  cierres: number;
  inferencias: number;
  miradaDesviada: boolean;
  falloAudio: boolean;
}
declare global { interface Window { pruebaVideo: PruebaVideo } }

async function preparar(page: Page, modelos: 'cpu' | 'error' | 'reales' = 'cpu') {
  await page.addInitScript(() => {
    window.pruebaVideo = { streams: [], inicios: 0, cancelaciones: 0, cierres: 0,
      inferencias: 0, miradaDesviada: false, falloAudio: false };
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints);
      window.pruebaVideo.streams.push(stream);
      return stream;
    };
  });
  if (modelos !== 'reales') await page.route('**/src/analysis/video/mediapipe.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: modelos === 'error'
      ? `export async function cargarModelos() { throw new Error('Modelo no disponible'); }
         export function cerrarModelos() {}`
      : `export async function cargarModelos() {
          const p = Array.from({length:478},()=>({x:.5,y:.5,z:0,visibility:1}));
          for(const [i,x,y] of [[33,.3,.4],[133,.4,.4],[159,.35,.39],[145,.35,.41],[468,.35,.4],
            [362,.6,.4],[263,.7,.4],[386,.65,.39],[374,.65,.41],[473,.65,.4]]) Object.assign(p[i],{x,y});
          const cuerpo = Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1}));
          cuerpo[11].x=.35; cuerpo[12].x=.65;
          return { cpu:true, rostro:{detectForVideo() {
            window.pruebaVideo.inferencias++;
            const yaw=window.pruebaVideo.miradaDesviada?.6:0;
            return {faceLandmarks:[p],faceBlendshapes:[{categories:[{categoryName:'eyeBlinkLeft',score:0}]}],
              facialTransformationMatrixes:[{data:[Math.cos(yaw),0,-Math.sin(yaw),0,0,1,0,0,Math.sin(yaw),0,Math.cos(yaw),0,0,0,0,1]}]};
          }},pose:{detectForVideo(){return {landmarks:[cuerpo],worldLandmarks:[],close(){}};}}};
        }
        export function cerrarModelos(modelos) { if(modelos) window.pruebaVideo.cierres++; }`,
  }));
  await page.goto('/');
  await page.evaluate(async () => {
    // Sólo en este navegador de prueba; no registra audio de producción.
    const ruta = '/src/integrations/audio.ts';
    const { registrarAdaptadorAudio } = await import(/* @vite-ignore */ ruta);
    registrarAdaptadorAudio({
      async iniciar(_stream: MediaStream, publicar: (m: { volumen: number; ritmo: null }) => void) {
        window.pruebaVideo.inicios++;
        publicar({ volumen: 60, ritmo: null });
        return {
          async detener() {
            if (window.pruebaVideo.falloAudio) throw new Error('Fallo controlado al detener audio');
            return { audio: new Blob(['audio de prueba'], { type: 'audio/webm' }),
              eventos: [{ t: 0, tipo: 'volumen_bajo', origen: 'audio', detalle: 'Evento de prueba' }] };
          },
          cancelar() { window.pruebaVideo.cancelaciones++; },
        };
      },
    });
  });
  await page.getByRole('button', { name: 'Activar cámara y micrófono' }).click();
  await expect(page.getByRole('button', { name: 'Cámara y micrófono disponibles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Comenzar ensayo' })).toBeDisabled();
  if (modelos === 'cpu') {
    await expect(page.getByText('Calibración lista. Puedes comenzar el ensayo cuando quieras.')).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(page.getByRole('alert')).toContainText(modelos === 'error' ? 'Puedes continuar' : 'No se logró calibrar', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Continuar sin análisis de video' }).click();
  }
  expect(await page.evaluate(() => window.pruebaVideo.inicios)).toBe(0);
  await page.getByRole('button', { name: 'Comenzar ensayo' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar grabación real' })).toBeVisible();
}

async function camarasCerradas(page: Page) {
  await expect.poll(() => page.evaluate(() => window.pruebaVideo.streams
    .every(s => s.getTracks().every(t => t.readyState === 'ended')))).toBe(true);
}

test('CPU muestra métricas y envía un episodio de video junto al audio', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', e => errores.push(e.message));
  await preparar(page);
  // StrictMode no debe apagar el stream prestado al montar la pantalla.
  expect(await page.evaluate(() => window.pruebaVideo.streams[0].getTracks().every(t => t.readyState === 'live'))).toBe(true);
  await page.getByRole('button', { name: 'Iniciar grabación real' }).click();
  await expect(page.getByText('Análisis activo en CPU.', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.metric').filter({ hasText: 'Orientación a la cámara' })).toContainText('100%');
  await expect(page.locator('.posture')).toContainText('Estabilidad: 100%');
  await expect.poll(() => page.locator('canvas').evaluate((c: HTMLCanvasElement) =>
    c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.some(v => v > 0))).toBe(true);
  await page.evaluate(() => { window.pruebaVideo.miradaDesviada = true; });
  // Episodio sostenido; el muestreo y el video continúan con reloj real.
  await page.waitForTimeout(6800);
  await page.getByRole('button', { name: 'Detener grabación', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analizar ensayo', exact: true })).toBeVisible();
  await camarasCerradas(page);
  await page.route('**/api/analizar', route => route.fulfill({ status: 503, body: 'Prueba: backend no necesario' }));
  const enviado = page.waitForRequest('**/api/analizar');
  await page.getByRole('button', { name: 'Analizar ensayo', exact: true }).click();
  const body = (await enviado).postData()!;
  expect(body).toContain('"origen":"audio"');
  expect(body).toContain('"origen":"video"');
  expect(body.match(/"tipo":"mirada_baja"/g)).toHaveLength(1);
  expect(body).not.toContain('name="video"');
  expect(await page.evaluate(() => window.pruebaVideo.inicios)).toBe(1);
  expect(errores).toEqual([]);
});

test('modelo ausente no impide grabar y detener audio', async ({ page }) => {
  await preparar(page, 'error');
  await page.getByRole('button', { name: 'Iniciar grabación real' }).click();
  await expect(page.getByRole('button', { name: 'Detener grabación', exact: true })).toBeVisible();
  await expect(page.getByText('Continuaste sin análisis de video.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Detener grabación', exact: true }).click();
  await camarasCerradas(page);
  await page.route('**/api/analizar', route => route.fulfill({ status: 503, body: 'Prueba' }));
  const enviado = page.waitForRequest('**/api/analizar');
  await page.getByRole('button', { name: 'Analizar ensayo', exact: true }).click();
  const body = (await enviado).postData()!;
  expect(body).toContain('"origen":"audio"');
  expect(body).not.toContain('"origen":"video"');
});

test('tres ensayos, descarte y salida liberan tracks y detectores', async ({ page }) => {
  await preparar(page);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Iniciar grabación real' }).click();
    await expect(page.getByRole('button', { name: 'Detener grabación', exact: true })).toBeVisible();
    if (i < 2) {
      await page.getByRole('button', { name: 'Detener grabación', exact: true }).click();
      await camarasCerradas(page);
      await page.getByRole('button', { name: 'Descartar y volver a grabar' }).click();
    }
  }
  await page.getByRole('button', { name: 'Volver al inicio', exact: true }).click();
  await page.locator('.exit-confirm').getByRole('button', { name: 'Volver al inicio' }).click();
  await camarasCerradas(page);
  await expect.poll(() => page.evaluate(() => window.pruebaVideo.cierres)).toBe(4);
  expect(await page.evaluate(() => window.pruebaVideo.inicios)).toBe(3);
});

test('un fallo al detener audio también apaga la cámara y permite reintentar', async ({ page }) => {
  await preparar(page);
  await page.getByRole('button', { name: 'Iniciar grabación real' }).click();
  await expect(page.getByRole('button', { name: 'Detener grabación', exact: true })).toBeVisible();
  await page.evaluate(() => { window.pruebaVideo.falloAudio = true; });
  await page.getByRole('button', { name: 'Detener grabación', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Fallo controlado');
  await camarasCerradas(page);
  await expect(page.getByRole('button', { name: 'Iniciar grabación real' })).toBeEnabled();
  expect(await page.evaluate(() => window.pruebaVideo.cancelaciones)).toBe(1);
});

test('MediaPipe real carga los archivos locales y deja continuar si no puede calibrar', async ({ page }) => {
  const recursos: string[] = [];
  page.on('response', r => { if (r.url().includes('/mediapipe/') && r.ok()) recursos.push(r.url()); });
  await preparar(page, 'reales');
  await page.getByRole('button', { name: 'Iniciar grabación real' }).click();
  await expect(page.getByRole('button', { name: 'Detener grabación', exact: true })).toBeVisible({ timeout: 30_000 });
  // La cámara sintética no contiene una persona: debe fallar la calibración, no inventar métricas.
  await expect(page.getByText('Continuaste sin análisis de video.', { exact: false })).toBeVisible();
  expect(recursos.some(r => r.endsWith('face_landmarker.task'))).toBe(true);
  expect(recursos.some(r => r.endsWith('pose_landmarker_lite.task'))).toBe(true);
  expect(recursos.some(r => r.endsWith('.wasm'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Detener grabación', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Detener grabación', exact: true }).click();
  await camarasCerradas(page);
});
