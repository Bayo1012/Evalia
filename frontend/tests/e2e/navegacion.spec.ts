import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`regreso entre pantallas conserva ensayo y respuestas a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errores: string[] = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Volver al paso anterior' });
    await expect(nav).toHaveCount(0);
    await page.getByRole('button', { name: 'Comenzar ensayo' }).click();
    await nav.getByRole('button', { name: 'Volver a preparación' }).click();
    await page.getByRole('button', { name: 'Seguir practicando' }).click();
    await expect(page.getByRole('button', { name: 'Detener grabación', exact: true })).toBeVisible();
    await nav.getByRole('button', { name: 'Volver a preparación' }).click();
    await page.locator('.exit-confirm').getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page.getByLabel('¿Qué vas a presentar y ante quién?')).toHaveValue('Sustentación de tesis ante 3 profesores');
    await page.getByRole('button', { name: 'Comenzar ensayo' }).click();
    await page.getByRole('button', { name: 'Detener grabación', exact: true }).click();
    await page.getByRole('button', { name: 'Analizar ensayo', exact: true }).click();
    await expect(page.locator('.loading-screen')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Así suena tu potencial.' })).toBeVisible();
    await nav.getByRole('button', { name: 'Volver a la grabación' }).click();
    await expect(page.getByRole('heading', { name: 'Una pausa para descubrir.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Detener grabación', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Analizar ensayo', exact: true }).click();
    await page.getByRole('button', { name: 'Ver preguntas del jurado' }).click();
    await page.getByRole('button', { name: 'Responder con voz' }).click();
    await page.getByRole('button', { name: 'Detener y enviar respuesta' }).click();
    await expect(nav.getByRole('button', { name: 'Volver al reporte' })).toBeDisabled();
    await expect(page.locator('.followup')).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente pregunta' }).click();
    await expect(page.getByLabel('Pregunta 2 de 3')).toBeVisible();
    const pregunta = await page.locator('.question-card h2').textContent();
    await nav.getByRole('button', { name: 'Volver al reporte' }).click();
    await page.getByRole('button', { name: 'Confirmar regreso al reporte' }).click();
    await expect(page.getByRole('heading', { name: 'Así suena tu potencial.' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver preguntas del jurado' }).click();
    await expect(page.getByLabel('Pregunta 2 de 3')).toBeVisible();
    await expect(page.locator('.question-card h2')).toHaveText(pregunta!);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('evalia.ensayos.v1')!)[0].respuestas[0])).toBeTruthy();
    await page.screenshot({ path: test.info().outputPath('navegacion.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errores).toEqual([]);
  });
}

test('un reporte del historial regresa a mis ensayos sin crear una grabación', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cargar ensayo de ejemplo' }).click();
  await page.locator('.history-item').first().click();
  await page.getByRole('button', { name: 'Volver a mis ensayos' }).click();
  await expect(page.getByRole('button', { name: 'Comenzar ensayo' })).toBeVisible();
  await expect(page.locator('.history-item')).toHaveCount(1);
});
