import type { Evento } from '../../types';
import { vistaInicial, type VistaVideo } from './interfaces';

export const vistaMock = (): VistaVideo => ({ ...vistaInicial(), aviso: 'MODO DEMO: métricas y eventos simulados.',
  metricas: { contactoVisual: 85, postura: 90 } });
/** Sólo ejemplos que ya caben en la duración del ensayo simulado. */
export function eventosMock(segundos: number): Evento[] {
  return segundos >= 8 ? [{ t: 2, tipo: 'mirada_baja', origen: 'video', detalle: '6.0 s sin contacto visual (simulado)' }] : [];
}
