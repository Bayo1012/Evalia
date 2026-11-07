import { describe, expect, it } from 'vitest';
import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { actualizarCalibracion, type MuestraBase } from './calibracion';
import { extraerRostro, desviacionMirada, miradaDesviada } from './faceAnalyzer';
import { balanceo, extraerPostura, manosOcultas, ventanaPostura } from './poseAnalyzer';
import { MotorVideo } from './motor';

const cara = { yaw: 0, pitch: 0, irisX: 0, irisY: 0, desviacionOjos: 0 };
const postura = { x: 0.5, y: 0.4, ancho: 0.3, inclinacion: 0 };
const muestra = (t: number): MuestraBase => ({ t, rostro: cara, postura });
function puntos(): NormalizedLandmark[] {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  p[11]!.x = 0.35; p[12]!.x = 0.65;
  return p;
}
function rostroValido(yaw = 0): FaceLandmarkerResult {
  const p = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  for (const [indice, x, y] of [[33, 0.3, 0.4], [133, 0.4, 0.4], [159, 0.35, 0.39], [145, 0.35, 0.41], [468, 0.35, 0.4],
    [362, 0.6, 0.4], [263, 0.7, 0.4], [386, 0.65, 0.39], [374, 0.65, 0.41], [473, 0.65, 0.4]]) {
    p[indice!]!.x = x!; p[indice!]!.y = y!;
  }
  return { faceLandmarks: [p], faceBlendshapes: [{ categories: [{ categoryName: 'eyeBlinkLeft', displayName: '', index: 0, score: 0 }], headIndex: 0, headName: '' }],
    facialTransformationMatrixes: [{ rows: 4, columns: 4, data: [Math.cos(yaw), 0, -Math.sin(yaw), 0,
      0, 1, 0, 0, Math.sin(yaw), 0, Math.cos(yaw), 0, 0, 0, 0, 1] }] };
}
describe('calibración', () => {
  it('requiere tres segundos y suficientes muestras', () => {
    let muestras: MuestraBase[] = [];
    for (let i = 0; i < 15; i++) {
      const r = actualizarCalibracion(muestras, muestra(i / 5), i / 5);
      expect(r.base).toBeNull(); muestras = r.muestras;
    }
    expect(actualizarCalibracion(muestras, muestra(3), 3).base?.rostro.yaw).toBe(0);
    expect(actualizarCalibracion([muestra(0)], muestra(3), 3).base).toBeNull();
  });
  it('rechaza cabeza girada, ojos desviados y pérdida de tracking', () => {
    const girada = { ...muestra(0), rostro: { ...cara, yaw: 0.7 } };
    expect(actualizarCalibracion([], girada, 0).muestras).toHaveLength(0);
    expect(actualizarCalibracion([], { ...muestra(0), rostro: { ...cara, desviacionOjos: 0.8 } }, 0).base).toBeNull();
    expect(actualizarCalibracion([muestra(0)], null, 2).muestras).toHaveLength(0);
  });
});
describe('señales', () => {
  it('diez minutos simulados generan un evento por episodio, no por frame', () => {
    const motor = new MotorVideo();
    const pose = { landmarks: [puntos()], worldLandmarks: [], close() {} };
    for (let i = 0; i <= 3000; i++) motor.procesar(rostroValido(i < 20 ? 0 : 0.6), pose, i / 5);
    const eventos = motor.detener();
    expect(eventos).toHaveLength(1); expect(eventos[0]?.tipo).toBe('mirada_baja');
    expect(eventos[0]!.t).toBeGreaterThanOrEqual(4); expect(motor.detener()).toEqual(eventos);
  });
  it('no interpreta un parpadeo o cara ausente como mirada baja', () => {
    const vacio: FaceLandmarkerResult = { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] };
    expect(extraerRostro(vacio)).toBeNull();
    const blink: FaceLandmarkerResult = { faceLandmarks: [Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))],
      facialTransformationMatrixes: [{ rows: 4, columns: 4, data: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }],
      faceBlendshapes: [{ categories: [{ categoryName: 'eyeBlinkLeft', displayName: '', index: 0, score: 0.9 }], headIndex: 0, headName: '' }] };
    expect(extraerRostro(blink)).toBeNull();
  });
  it('compara la mirada con su línea base', () => {
    expect(desviacionMirada(cara, cara)).toBe(0);
    expect(miradaDesviada(desviacionMirada({ ...cara, yaw: 0.5 }, cara), false)).toBe(true);
    expect(miradaDesviada(desviacionMirada({ ...cara, irisX: 0.3 }, cara), false)).toBe(true);
  });
  it('distingue muñecas invisibles de cuerpo sin tracking', () => {
    const p = puntos(); expect(manosOcultas(p)).toBe(false);
    p[15]!.visibility = 0.1; expect(manosOcultas(p)).toBe(true);
    p[11]!.visibility = 0.1; expect(manosOcultas(p)).toBeNull();
    expect(extraerPostura([])).toBeNull();
  });
  it('la ventana de balanceo es acotada y una postura fija no oscila', () => {
    let ventana = ventanaPostura([], postura, postura, 0);
    ventana = ventanaPostura(ventana, postura, postura, 0.2);
    ventana = ventanaPostura(ventana, postura, postura, 0.4);
    expect(balanceo(ventana)).toBe(0);
    ventana = ventanaPostura(ventana, { ...postura, x: 0.7 }, postura, 0.6);
    expect(balanceo(ventana)).toBeGreaterThan(0.15);
    expect(ventanaPostura(ventana, postura, postura, 10)).toHaveLength(1);
  });
  it('la calibración sin detecciones falla y detener repetidamente no duplica', () => {
    const motor = new MotorVideo();
    const r = motor.procesar({ faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] },
      { landmarks: [], worldLandmarks: [], close() {} }, 12);
    expect(r.falloCalibracion).toBe(true);
    expect(motor.detener()).toEqual([]); expect(motor.detener()).toEqual([]);
  });
});
