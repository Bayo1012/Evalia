import type { Analisis, Contexto, Evento, Repregunta } from "../types";
const base = import.meta.env.VITE_API_URL ?? "";
async function post<T>(
  ruta: string,
  form: FormData,
  validar: (x: unknown) => x is T,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${base}${ruta}`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        `El servidor no pudo procesar el ensayo (${response.status}).`,
      );
    const data: unknown = await response.json();
    if (!validar(data))
      throw new Error("La respuesta del servidor tiene un formato inesperado.");
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error(
        "El análisis tardó demasiado. Tu grabación sigue disponible para reintentar.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export function esAnalisis(x: unknown): x is Analisis {
  if (!x || typeof x !== "object") return false;
  const a = x as Analisis;
  return (
    Number.isFinite(a.duracion) &&
    a.duracion >= 0 &&
    ["predeterminada", "personalizada"].includes(a.rubrica_usada) &&
    !!a.puntajes &&
    ["voz", "cuerpo", "contenido", "total"].every(
      (k) =>
        Number.isFinite(a.puntajes[k as keyof Analisis["puntajes"]]) &&
        a.puntajes[k as keyof Analisis["puntajes"]] >= 0 &&
        a.puntajes[k as keyof Analisis["puntajes"]] <= 100,
    ) &&
    Array.isArray(a.eventos) &&
    a.eventos.every(
      (e) =>
        e &&
        Number.isFinite(e.t) &&
        e.t >= 0 &&
        e.t <= a.duracion &&
        [
          "mirada_baja",
          "postura_inestable",
          "manos_ocultas",
          "volumen_bajo",
          "volumen_alto",
          "pausa_larga",
          "ritmo_rapido",
          "ritmo_lento",
          "muletilla",
        ].includes(e.tipo) &&
        ["video", "audio", "transcripcion"].includes(e.origen) &&
        typeof e.detalle === "string",
    ) &&
    Array.isArray(a.transcripcion) &&
    a.transcripcion.every(
      (w) =>
        w &&
        typeof w.palabra === "string" &&
        Number.isFinite(w.inicio) &&
        Number.isFinite(w.fin),
    ) &&
    [a.recomendaciones, a.preguntas_jurado].every(
      (v) =>
        Array.isArray(v) &&
        v.length === 3 &&
        v.every((s) => typeof s === "string" && s.trim()),
    )
  );
}
export function esRepregunta(x: unknown): x is Repregunta {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as Repregunta).transcripcion_respuesta === "string" &&
    typeof (x as Repregunta).repregunta === "string"
  );
}
function formulario(audio: Blob, contexto: Contexto) {
  const f = new FormData();
  f.append(
    "audio",
    audio,
    audio.type.includes("mp4") ? "respuesta.m4a" : "respuesta.webm",
  );
  f.append("contexto", JSON.stringify(contexto));
  return f;
}
export function analizar(audio: Blob, contexto: Contexto, eventos: Evento[]) {
  const f = formulario(audio, contexto);
  f.append("eventos_cliente", JSON.stringify(eventos));
  return post("/api/analizar", f, esAnalisis);
}
export function repreguntar(audio: Blob, pregunta: string, contexto: Contexto) {
  const f = formulario(audio, contexto);
  f.append("pregunta", pregunta);
  return post("/api/repregunta", f, esRepregunta);
}
