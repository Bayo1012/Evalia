import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { VIDEO_CONFIG as C } from './config';

export interface SenalPostura { x: number; y: number; ancho: number; inclinacion: number }
export interface MuestraPostura { t: number; valor: number }
const visible = (p: NormalizedLandmark | undefined): p is NormalizedLandmark => !!p
  && [p.x, p.y, p.z, p.visibility].every(Number.isFinite) && p.visibility >= C.visibilidad
  && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
export function extraerPostura(p: NormalizedLandmark[]): SenalPostura | null {
  const a = p[11], b = p[12];
  if (!visible(a) || !visible(b)) return null;
  const ancho = Math.hypot(b.x - a.x, b.y - a.y);
  if (ancho < C.hombrosAnchoMinimo) return null;
  // Centro de hombros como proxy del torso; las caderas suelen quedar fuera en webcam.
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ancho, inclinacion: (b.y - a.y) / ancho };
}
export function manosOcultas(p: NormalizedLandmark[]): boolean | null {
  if (!extraerPostura(p)) return null;
  return !visible(p[15]) || !visible(p[16]);
}
export function ventanaPostura(historial: readonly MuestraPostura[], actual: SenalPostura,
  base: SenalPostura, t: number): MuestraPostura[] {
  return [...historial.filter(m => t - m.t <= C.posturaVentana),
    { t, valor: (actual.x - base.x) / base.ancho + (actual.inclinacion - base.inclinacion) * 0.5 }];
}
export function balanceo(historial: readonly MuestraPostura[]): number {
  if (historial.length < 3) return 0;
  const valores = historial.map(m => m.valor);
  return Math.max(...valores) - Math.min(...valores);
}
