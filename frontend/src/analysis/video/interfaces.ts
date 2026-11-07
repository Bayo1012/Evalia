import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Evento } from '../../types';

export type EstadoVideo = 'cargando' | 'listo' | 'error';
export interface LandmarksVideo {
  rostro: NormalizedLandmark[];
  pose: NormalizedLandmark[];
}
export interface VistaVideo {
  estado: EstadoVideo;
  error: string | null;
  aviso: string | null;
  calibrando: boolean;
  fiable: boolean;
  metricas: { contactoVisual: number; postura: number };
  landmarks: LandmarksVideo;
}
export interface AnalisisVideo extends VistaVideo {
  iniciar: () => Promise<void>;
  detener: () => Evento[];
  reiniciar: () => Promise<void>;
  sincronizarInicio: (inicioMs: number) => void;
}
export const vistaInicial = (): VistaVideo => ({
  estado: 'listo', error: null, aviso: 'Análisis sin iniciar.', calibrando: false, fiable: false,
  // Cero significa sin medición hasta que termine la calibración (ver aviso).
  metricas: { contactoVisual: 0, postura: 0 }, landmarks: { rostro: [], pose: [] },
});
