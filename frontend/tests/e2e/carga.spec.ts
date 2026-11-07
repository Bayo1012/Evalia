import { test, expect } from '@playwright/test';

declare global { interface Window { terminarAnalisis: () => void } }
for (const width of [1440, 390]) {
  test(`carga espera al análisis, usa logo transparente y bloquea el fondo a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.route('**/src/api/services.ts*', route => route.fulfill({
      contentType: 'application/javascript', body: `
        import { analisisDemo } from '/src/api/demo.ts';
        export function analizarEnsayo() { return new Promise(resolve => {
          window.terminarAnalisis = () => resolve(structuredClone(analisisDemo));
        }); }
        export async function responderJurado() { throw new Error('Fuera de esta prueba'); }
      `,
    }));
    await page.goto('/');
    await expect(page.locator('.loading-screen')).toHaveCount(0);
    await page.getByRole('button', { name: 'Comenzar ensayo' }).click();
    await expect(page.locator('.loading-screen')).toHaveCount(0);
    await page.getByRole('button', { name: 'Detener grabación', exact: true }).click();
    await page.getByRole('button', { name: 'Analizar ensayo', exact: true }).click();
    const carga = page.getByRole('status');
    await expect(carga).toContainText('Estamos analizando tu ensayo');
    await expect(carga).toBeFocused();
    expect(await page.locator('.app-shell').evaluate(e => (e as HTMLElement).inert)).toBe(true);
    await expect(carga.locator('svg circle')).toHaveCount(24);
    await expect.poll(() => carga.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await carga.locator('img').evaluate((img: HTMLImageElement) => {
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, 1, 1).data[3];
    })).toBe(0);
    expect(await carga.locator('svg').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
    await page.screenshot({ path: test.info().outputPath('carga.png'), fullPage: true });
    await page.waitForTimeout(3200);
    await expect(carga).toBeVisible(); // El mínimo ya pasó; falta la respuesta.
    await page.evaluate(() => window.terminarAnalisis());
    await expect(page.getByRole('heading', { name: 'Así suena tu potencial.' })).toBeVisible();
    await expect(page.locator('.loading-screen')).toHaveCount(0);
    expect(await page.locator('.app-shell').evaluate(e => (e as HTMLElement).inert)).toBe(false);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });
}
