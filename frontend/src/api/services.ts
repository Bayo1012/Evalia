import type { Contexto, Intento } from "../types";
import { analisisDemo, respuestasDemo } from "./demo";
import * as cliente from "./client";
export const esperar = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export async function analizarEnsayo(
  demo: boolean,
  intento: Intento,
  contexto: Contexto,
  fallar = false,
) {
  if (demo) {
    await esperar(1600);
    if (fallar)
      throw new Error(
        "Error de demostración: no pudimos conectar. Tu intento está a salvo; vuelve a intentarlo.",
      );
    return {
      ...structuredClone(analisisDemo),
      rubrica_usada: contexto.rubrica.trim()
        ? ("personalizada" as const)
        : ("predeterminada" as const),
    };
  }
  if (!intento.audio?.size)
    throw new Error(
      "No hay audio disponible. Conecta el adaptador de grabación.",
    );
  return cliente.analizar(intento.audio, contexto, intento.eventos);
}
export async function responderJurado(
  demo: boolean,
  indice: number,
  audio: Blob | undefined,
  pregunta: string,
  contexto: Contexto,
) {
  if (demo) {
    await esperar(1100);
    return structuredClone(respuestasDemo[indice]);
  }
  if (!audio?.size)
    throw new Error("No hay una respuesta de audio disponible.");
  return cliente.repreguntar(audio, pregunta, contexto);
}
