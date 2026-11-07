import type { Evento } from "../types";
/** main.tsx registra el grabador antes de montar App. Esta interfaz separa la grabación de las pantallas. */
export interface MetricasAudio {
  volumen: number | null;
  ritmo: number | null;
}
export interface SesionAudio {
  detener(): Promise<{ audio: Blob; video?: Blob; eventos: Evento[] }>;
  cancelar(): void;
}
export interface AdaptadorAudio {
  iniciar(
    stream: MediaStream,
    publicar: (metricas: MetricasAudio) => void,
  ): Promise<SesionAudio>;
}
let adaptador: AdaptadorAudio | null = null;
export function registrarAdaptadorAudio(implementacion: AdaptadorAudio) {
  adaptador = implementacion;
}
export function obtenerAdaptadorAudio() {
  return adaptador;
}
export function liberarStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
