import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrirCamara, liberarCamara, mensajeError } from './camara';

class StreamPrueba {
  track = { readyState: 'live', stop: vi.fn() };
  getVideoTracks() { return [this.track]; }
  getTracks() { return [this.track]; }
}
afterEach(() => { vi.unstubAllGlobals(); });
describe('propiedad de la cámara', () => {
  it('detiene todos los tracks propios y retira el stream del elemento', async () => {
    const stream = new StreamPrueba();
    vi.stubGlobal('MediaStream', StreamPrueba);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    const video = { srcObject: null } as unknown as HTMLVideoElement;
    const c = await abrirCamara(video, new AbortController().signal);
    liberarCamara(c, video);
    expect(stream.track.stop).toHaveBeenCalledOnce(); expect(video.srcObject).toBeNull();
  });
  it('no detiene un stream compartido por la grabación', async () => {
    const stream = new StreamPrueba(); vi.stubGlobal('MediaStream', StreamPrueba);
    const video = { srcObject: stream } as unknown as HTMLVideoElement;
    const c = await abrirCamara(video, new AbortController().signal);
    expect(c.propia).toBe(false); liberarCamara(c, video);
    expect(stream.track.stop).not.toHaveBeenCalled(); expect(video.srcObject).toBe(stream);
  });
  it('libera un permiso resuelto después de cancelar', async () => {
    const stream = new StreamPrueba(), abort = new AbortController();
    vi.stubGlobal('MediaStream', StreamPrueba);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => { abort.abort(); return stream; }) } });
    await expect(abrirCamara({ srcObject: null } as HTMLVideoElement, abort.signal)).rejects.toBeDefined();
    expect(stream.track.stop).toHaveBeenCalledOnce();
  });
  it.each([['NotAllowedError', 'denegado'], ['NotReadableError', 'ocupada'], ['NotFoundError', 'No se encontró']])(
    'traduce %s a un aviso claro', (nombre, esperado) => {
      const error = new Error(); error.name = nombre; expect(mensajeError(error)).toContain(esperado);
    });
});
