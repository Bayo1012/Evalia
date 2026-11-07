import { test, expect } from "@playwright/test";
for (const width of [1440, 390]) {
  test(`recorrido completo, reintento, persistencia y borrado a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let mediaRequests = 0;
    await page.exposeFunction("mediaRequested", () => {
      mediaRequests++;
    });
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        await (
          window as unknown as { mediaRequested: () => Promise<void> }
        ).mediaRequested();
        throw new Error("No se permiten medios en demo");
      };
    });
    await page.goto("/");
    await expect(page.getByText("Modo demo: datos simulados")).toBeVisible();
    await page
      .getByRole("button", { name: "Cargar ensayo de ejemplo" })
      .click();
    await page.locator(".rubric summary").click();
    await page
      .getByLabel("Rúbrica personalizada")
      .fill("Evaluar claridad del objetivo y evidencia.");
    await page.screenshot({
      path: `test-results/inicio-${width}.png`,
      fullPage: true,
    });
    for (let run = 0; run < (width === 1440 ? 3 : 1); run++) {
      await page.getByRole("button", { name: "Comenzar ensayo" }).click();
      await expect(
        page.getByRole("heading", { name: "Dale voz a tu idea." }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Detener grabación", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Analizar ensayo", exact: true }),
      ).toBeVisible();
      if (run === 0) {
        await page
          .getByRole("button", { name: "Descartar y volver a grabar" })
          .click();
        await expect(page.locator(".timer")).toContainText("00:00");
        await page
          .getByRole("button", { name: "Detener grabación", exact: true })
          .click();
        await page
          .getByLabel("Simular error en el próximo análisis (solo una vez)")
          .check();
        await page
          .getByRole("button", { name: "Analizar ensayo", exact: true })
          .click();
        await expect(page.getByRole("status")).toContainText(
          "Preparando tu reporte",
        );
        await expect(page.getByRole("alert")).toContainText(
          "Error de demostración",
        );
        await page.getByRole("button", { name: "Reintentar análisis" }).click();
      } else
        await page
          .getByRole("button", { name: "Analizar ensayo", exact: true })
          .click();
      await expect(
        page.getByRole("heading", { name: "Así suena tu potencial." }),
      ).toBeVisible();
      await expect(
        page.getByText("Rúbrica personalizada", { exact: false }),
      ).toBeVisible();
      await expect(page.locator(".comparison")).toHaveCount(4);
      await page
        .getByRole("button", { name: "01:20 Mirada hacia abajo" })
        .click();
      await expect(page.locator(".moment-detail")).toContainText(
        "Miraste hacia abajo",
      );
      if (run === 0)
        await page.screenshot({
          path: `test-results/reporte-${width}.png`,
          fullPage: true,
        });
      await page
        .getByRole("button", { name: "Ver preguntas del jurado" })
        .click();
      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: "Responder con voz" }).click();
        await expect(
          page.getByText("Grabación simulada de tu respuesta"),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Detener y enviar respuesta" })
          .dblclick();
        await expect(page.locator(".followup")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Responder con voz" }),
        ).toHaveCount(0);
        await expect
          .poll(async () =>
            page.evaluate(
              () =>
                JSON.parse(localStorage.getItem("evalia.ensayos.v1") ?? "[]")[0]
                  .solicitudes.length,
            ),
          )
          .toBe(i + 1);
        if (i === 0 && run === 0)
          await page.screenshot({
            path: `test-results/jurado-${width}.png`,
            fullPage: true,
          });
        await page
          .getByRole("button", {
            name: i === 2 ? "Finalizar práctica" : "Siguiente pregunta",
          })
          .click();
      }
      await expect(
        page.getByRole("heading", { name: "Tu voz ya llegó más lejos." }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Nuevo ensayo" }).click();
      await expect(
        page.getByLabel("¿Qué vas a presentar y ante quién?"),
      ).toHaveValue("Sustentación de tesis ante 3 profesores");
    }
    await page.reload();
    await expect(page.locator(".history-item")).toHaveCount(
      width === 1440 ? 4 : 2,
    );
    await page.locator(".history-item").first().click();
    await page
      .getByRole("button", { name: "Ver preguntas del jurado" })
      .click();
    await expect(page.locator(".followup")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Responder con voz" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Volver al inicio", exact: true })
      .click();
    await page
      .locator(".exit-confirm")
      .getByRole("button", { name: "Volver al inicio" })
      .click();
    await page.getByRole("button", { name: "Borrar mis datos" }).click();
    await page.getByRole("button", { name: "Confirmar borrado" }).click();
    await page.reload();
    await expect(page.locator(".history-item")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(mediaRequests).toBe(0);
    expect(errors).toEqual([]);
  });
}
test("modo real con audio conectado y texto requerido", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("¿Qué vas a presentar y ante quién?").fill("   ");
  await expect(
    page.getByRole("button", { name: "Comenzar ensayo" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Ensayo real", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Activar cámara y micrófono" }),
  ).toBeVisible();
  await expect(page.getByText("La grabación real estará disponible", { exact: false })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Comenzar ensayo" }),
  ).toBeDisabled();
});
