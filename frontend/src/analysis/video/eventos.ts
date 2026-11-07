import type { Evento } from '../../types';
import { VIDEO_CONFIG as C } from './config';

export type TipoVideo = Extract<Evento['tipo'], 'mirada_baja' | 'postura_inestable' | 'manos_ocultas'>;
export interface Episodio { inicio: number | null; ultimo: number | null; recuperando: number | null }
export const episodioVacio = (): Episodio => ({ inicio: null, ultimo: null, recuperando: null });
const minimo = (tipo: TipoVideo) => tipo === 'mirada_baja' ? C.miradaSegundos
  : tipo === 'manos_ocultas' ? C.manosSegundos : C.posturaSegundos;

export function cerrarEpisodio(e: Episodio, tipo: TipoVideo): Evento | null {
  if (e.inicio === null || e.ultimo === null) return null;
  const duracion = (e.recuperando ?? e.ultimo) - e.inicio;
  if (duracion <= minimo(tipo)) return null;
  const texto = tipo === 'mirada_baja' ? 'sin contacto visual estimado'
    : tipo === 'manos_ocultas' ? 'con manos fuera de cuadro o poco visibles' : 'con balanceo de postura';
  return { t: e.inicio, tipo, origen: 'video', detalle: `${duracion.toFixed(1)} s ${texto}` };
}

/** null = señal desconocida; nunca se cuenta como una conducta negativa. */
export function avanzarEpisodio(e: Episodio, activo: boolean | null, t: number, tipo: TipoVideo): {
  estado: Episodio; evento: Evento | null;
} {
  if (!Number.isFinite(t) || (e.ultimo !== null && t < e.ultimo)) return { estado: e, evento: null };
  if (e.ultimo !== null && t - e.ultimo > C.huecoMaximo) {
    const evento = cerrarEpisodio(e, tipo);
    return { estado: activo === true ? { inicio: t, ultimo: t, recuperando: null } : episodioVacio(), evento };
  }
  if (activo === null) return { estado: e, evento: null };
  if (activo) return { estado: { inicio: e.inicio ?? t, ultimo: t, recuperando: null }, evento: null };
  if (e.inicio === null) return { estado: episodioVacio(), evento: null };
  const recuperando = e.recuperando ?? t;
  const siguiente = { ...e, ultimo: t, recuperando };
  return t - recuperando >= C.recuperacionSegundos
    ? { estado: episodioVacio(), evento: cerrarEpisodio(siguiente, tipo) }
    : { estado: siguiente, evento: null };
}

export function histeresis(valor: number, anterior: boolean, entrada: number, salida: number): boolean {
  return anterior ? valor > salida : valor > entrada;
}
export function suavizar(valores: readonly number[], valor: number): number[] {
  return [...valores, valor].slice(-C.suavizadoMuestras);
}
export const promedio = (valores: readonly number[]): number =>
  valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
