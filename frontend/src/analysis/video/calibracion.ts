import { VIDEO_CONFIG as C } from './config';
import type { SenalRostro } from './faceAnalyzer';
import type { SenalPostura } from './poseAnalyzer';

export interface MuestraBase { t: number; rostro: SenalRostro; postura: SenalPostura }
export interface BaseVideo { rostro: SenalRostro; postura: SenalPostura }
export function actualizarCalibracion(muestras: readonly MuestraBase[], muestra: MuestraBase | null,
  t: number): { muestras: MuestraBase[]; base: BaseVideo | null } {
  if (!muestra || Math.abs(muestra.rostro.yaw) > C.calibracionCabezaMaxima || Math.abs(muestra.rostro.pitch) > C.calibracionCabezaMaxima
    || Math.abs(muestra.rostro.irisX) > C.calibracionIrisMaximo || Math.abs(muestra.rostro.irisY) > C.calibracionIrisMaximo
    || muestra.rostro.desviacionOjos > C.calibracionBlendMaximo) {
    return { muestras: muestras.length && t - muestras[muestras.length - 1]!.t <= C.huecoMaximo ? [...muestras] : [], base: null };
  }
  const ultima = muestras[muestras.length - 1];
  const primera = muestras[0];
  const estable = !primera || (Math.abs(muestra.rostro.yaw - primera.rostro.yaw) < C.calibracionVariacionCabeza
    && Math.abs(muestra.rostro.pitch - primera.rostro.pitch) < C.calibracionVariacionCabeza
    && Math.abs(muestra.postura.x - primera.postura.x) / primera.postura.ancho < C.calibracionVariacionPostura);
  const siguientes = !estable || (ultima && t - ultima.t > C.huecoMaximo) ? [muestra] : [...muestras, muestra];
  if (t - siguientes[0]!.t < C.calibracionSegundos || siguientes.length < C.muestrasCalibracion)
    return { muestras: siguientes, base: null };
  const media = (valor: (m: MuestraBase) => number) => siguientes.reduce((s, m) => s + valor(m), 0) / siguientes.length;
  return { muestras: [], base: {
    rostro: { yaw: media(m => m.rostro.yaw), pitch: media(m => m.rostro.pitch), irisX: media(m => m.rostro.irisX),
      irisY: media(m => m.rostro.irisY), desviacionOjos: media(m => m.rostro.desviacionOjos) },
    postura: { x: media(m => m.postura.x), y: media(m => m.postura.y), ancho: media(m => m.postura.ancho),
      inclinacion: media(m => m.postura.inclinacion) },
  } };
}
