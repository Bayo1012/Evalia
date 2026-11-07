import { afterEach, expect, it, vi } from "vitest";
import { analizar, esAnalisis, repreguntar } from "./client";
import { analisisDemo, contextoDemo, respuestasDemo } from "./demo";
afterEach(() => vi.unstubAllGlobals());
it("envia solo audio, contexto y eventos como multipart", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => analisisDemo });
  vi.stubGlobal("fetch", fetch);
  await analizar(
    new Blob(["audio"], { type: "audio/webm" }),
    contextoDemo,
    analisisDemo.eventos,
  );
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe("/api/analizar");
  expect([...init.body.keys()]).toEqual([
    "audio",
    "contexto",
    "eventos_cliente",
  ]);
  expect(JSON.parse(init.body.get("contexto"))).toEqual(contextoDemo);
  expect(init.headers).toBeUndefined();
});
it("envia una pregunta sin inventar session_id", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => respuestasDemo[0] });
  vi.stubGlobal("fetch", fetch);
  await repreguntar(new Blob(["audio"]), "Pregunta", contextoDemo);
  expect([...fetch.mock.calls[0][1].body.keys()]).toEqual([
    "audio",
    "contexto",
    "pregunta",
  ]);
});
it("rechaza respuestas incompletas y puntajes fuera de rango", () => {
  expect(esAnalisis(analisisDemo)).toBe(true);
  expect(esAnalisis({ ...analisisDemo, preguntas_jurado: ["una"] })).toBe(
    false,
  );
  expect(
    esAnalisis({
      ...analisisDemo,
      puntajes: { ...analisisDemo.puntajes, total: 101 },
    }),
  ).toBe(false);
});
it("conserva un mensaje util ante error del backend", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
  await expect(analizar(new Blob(["a"]), contextoDemo, [])).rejects.toThrow(
    "503",
  );
});

it("muestra el detalle del error de FastAPI", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false, status: 422, json: async () => ({ detail: "No se pudo obtener texto del audio." }),
  }));
  await expect(analizar(new Blob(["a"]), contextoDemo, [])).rejects.toThrow("No se pudo obtener texto del audio.");
});
