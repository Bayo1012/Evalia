import type { Ensayo } from "../types";
import { esAnalisis, esRepregunta } from "../api/client";
const CLAVE = "evalia.ensayos.v1";
function esEnsayo(x: unknown): x is Ensayo {
  if (!x || typeof x !== "object") return false;
  const e = x as Ensayo;
  return (
    typeof e.id === "string" &&
    typeof e.fecha === "string" &&
    Number.isFinite(Date.parse(e.fecha)) &&
    typeof e.demo === "boolean" &&
    !!e.contexto &&
    typeof e.contexto.presentacion === "string" &&
    typeof e.contexto.rubrica === "string" &&
    ["exigente", "curioso", "formal", "publico_general"].includes(
      e.contexto.jurado,
    ) &&
    esAnalisis(e.resultado) &&
    !!e.respuestas &&
    Object.values(e.respuestas).every(esRepregunta) &&
    Array.isArray(e.solicitudes) &&
    e.solicitudes.every((i) => Number.isInteger(i) && i >= 0 && i < 3)
  );
}
export function listarEnsayos(): Ensayo[] {
  try {
    const datos: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(datos) ? datos.filter(esEnsayo) : [];
  } catch {
    return [];
  }
}
export function guardarEnsayo(ensayo: Ensayo): void {
  const lista = [ensayo, ...listarEnsayos().filter((e) => e.id !== ensayo.id)]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 30);
  localStorage.setItem(CLAVE, JSON.stringify(lista));
}
export function borrarEnsayos(): void {
  localStorage.removeItem(CLAVE);
}
