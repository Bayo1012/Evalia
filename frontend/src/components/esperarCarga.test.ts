import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarCarga } from './esperarCarga';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe('duración de la pantalla de carga', () => {
  it('mantiene una operación rápida durante al menos tres segundos', async () => {
    const terminado = vi.fn();
    const tarea = esperarCarga(Promise.resolve('reporte')).then(terminado);
    await vi.advanceTimersByTimeAsync(2999);
    expect(terminado).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await tarea;
    expect(terminado).toHaveBeenCalledWith('reporte');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('espera una operación lenta sin añadir otros tres segundos', async () => {
    const terminado = vi.fn();
    const tarea = esperarCarga(new Promise<string>(resolve => setTimeout(() => resolve('reporte'), 7000))).then(terminado);
    await vi.advanceTimersByTimeAsync(6999);
    expect(terminado).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await tarea;
    expect(terminado).toHaveBeenCalledWith('reporte');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('propaga el error al acabar el mínimo para permitir el reintento', async () => {
    const error = new Error('sin conexión');
    const tarea = esperarCarga(Promise.reject(error));
    const comprobacion = expect(tarea).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(3000); await comprobacion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
