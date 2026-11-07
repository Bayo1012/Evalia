import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { VIDEO_CONFIG as C } from './config';
import { histeresis } from './eventos';

export interface SenalRostro { yaw: number; pitch: number; irisX: number; irisY: number; desviacionOjos: number }
export function extraerRostro(r: FaceLandmarkerResult): SenalRostro | null {
  const p = r.faceLandmarks[0];
  const m = r.facialTransformationMatrixes[0]?.data;
  const categorias = r.faceBlendshapes[0]?.categories;
  if (!p || !m || m.length !== 16 || !categorias?.length) return null;
  const score = (nombre: string) => categorias.find(c => c.categoryName === nombre)?.score ?? 0;
  if (Math.max(score('eyeBlinkLeft'), score('eyeBlinkRight')) > C.parpadeo) return null;
  const ojos = [[33, 133, 159, 145, 468], [362, 263, 386, 374, 473]];
  const iris = ojos.map(([a, b, arriba, abajo, centro]) => {
    const l = p[a!], d = p[b!], u = p[arriba!], v = p[abajo!], i = p[centro!];
    if (!l || !d || !u || !v || !i) return null;
    const ancho = Math.hypot(d.x - l.x, d.y - l.y);
    if (ancho < C.ojoAnchoMinimo || Math.hypot(u.x - v.x, u.y - v.y) / ancho < C.ojoAperturaMinima) return null;
    // Proyección sobre el eje del ojo: reduce sensibilidad al roll de la cabeza.
    const dx = i.x - (l.x + d.x) / 2, dy = i.y - (l.y + d.y) / 2;
    const ejeX = (d.x - l.x) / ancho, ejeY = (d.y - l.y) / ancho;
    return { x: (dx * ejeX + dy * ejeY) / ancho, y: (-dx * ejeY + dy * ejeX) / ancho };
  });
  if (!iris[0] || !iris[1]) return null;
  // Matriz column-major de MediaPipe; normalizar evita confundir escala con rotación.
  const yaw = Math.atan2(m[8]!, m[10]!);
  const pitch = Math.atan2(-m[9]!, Math.hypot(m[8]!, m[10]!));
  const desviacionOjos = Math.max(...['eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookUpLeft',
    'eyeLookUpRight', 'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight'].map(score));
  const resultado = { yaw, pitch, irisX: (iris[0].x + iris[1].x) / 2,
    irisY: (iris[0].y + iris[1].y) / 2, desviacionOjos };
  return Object.values(resultado).every(Number.isFinite) ? resultado : null;
}
export function desviacionMirada(actual: SenalRostro, base: SenalRostro): number {
  const angulo = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  return Math.max(angulo(actual.yaw, base.yaw) / C.cabezaEntrada,
    angulo(actual.pitch, base.pitch) / C.cabezaEntrada,
    Math.hypot(actual.irisX - base.irisX, actual.irisY - base.irisY) / C.irisEntrada,
    Math.max(0, actual.desviacionOjos - base.desviacionOjos) / C.blendEntrada);
}
export const miradaDesviada = (valor: number, anterior: boolean): boolean =>
  histeresis(valor, anterior, 1, Math.min(C.cabezaSalida / C.cabezaEntrada,
    C.irisSalida / C.irisEntrada, C.blendSalida / C.blendEntrada));
