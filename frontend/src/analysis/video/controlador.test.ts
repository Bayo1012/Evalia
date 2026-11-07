import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Modelos } from './mediapipe';
import type { CamaraVideo } from './camara';
import type { VistaVideo } from './interfaces';
import { ControladorVideo } from './controlador';
import { cargarModelos, cerrarModelos } from './mediapipe';
import { abrirCamara, liberarCamara } from './camara';

vi.mock('./mediapipe', () => ({ cargarModelos: vi.fn(), cerrarModelos: vi.fn() }));
vi.mock('./camara', () => ({ abrirCamara: vi.fn(), liberarCamara: vi.fn(), mensajeError: () => 'Continúa sin análisis de video.' }));
function diferido<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>(resolve => { resolver = resolve; });
  return { promesa, resolver };
}
const video = () => ({ play: vi.fn().mockResolvedValue(undefined), readyState: 2, currentTime: 1 }) as unknown as HTMLVideoElement;
const modelos = () => ({ cpu: false, rostro: { detectForVideo: vi.fn(() => ({ faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] })) },
  pose: { detectForVideo: vi.fn(() => ({ landmarks: [], worldLandmarks: [], close: vi.fn() })) } }) as unknown as Modelos;
const camara = () => ({ propia: true, stream: { getVideoTracks: () => [{ readyState: 'live' }] } }) as unknown as CamaraVideo;
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); });
afterEach(() => { vi.useRealTimers(); });
describe('ciclo de vida', () => {
  it('sincroniza los eventos con el inicio efectivo del audio', async () => {
    const controlador = new ControladorVideo(() => null, vi.fn(), true);
    await controlador.iniciar(); await vi.advanceTimersByTimeAsync(10_000);
    controlador.sincronizarInicio(performance.now());
    await vi.advanceTimersByTimeAsync(7000);
    expect(controlador.detener()).toEqual([]);
    await controlador.iniciar(); await vi.advanceTimersByTimeAsync(8000);
    expect(controlador.detener()[0]?.t).toBe(2);
  });
  it('iniciar repetido comparte una inicialización y detener libera recursos', async () => {
    const m = modelos(), c = camara(), v = video();
    vi.mocked(cargarModelos).mockResolvedValue(m); vi.mocked(abrirCamara).mockResolvedValue(c);
    const controlador = new ControladorVideo(() => v, vi.fn());
    const a = controlador.iniciar(), b = controlador.iniciar();
    expect(a).toBe(b); await a;
    expect(cargarModelos).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    expect(controlador.detener()).toEqual([]); expect(controlador.detener()).toEqual([]);
    expect(cerrarModelos).toHaveBeenCalledWith(m); expect(liberarCamara).toHaveBeenCalledWith(c, v);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('libera un modelo que llega después del desmontaje sin abrir cámara', async () => {
    const pendiente = diferido<Modelos>(), m = modelos();
    vi.mocked(cargarModelos).mockReturnValue(pendiente.promesa);
    const publicar = vi.fn(); const controlador = new ControladorVideo(video, publicar);
    const inicio = controlador.iniciar(); await Promise.resolve(); controlador.destruir();
    const llamadas = publicar.mock.calls.length;
    pendiente.resolver(m); await inicio;
    expect(cerrarModelos).toHaveBeenCalledWith(m); expect(abrirCamara).not.toHaveBeenCalled();
    expect(publicar).toHaveBeenCalledTimes(llamadas); expect(vi.getTimerCount()).toBe(0);
  });
  it('libera una cámara tardía y no reactiva el bucle', async () => {
    const pendiente = diferido<CamaraVideo>(), c = camara(), v = video();
    vi.mocked(cargarModelos).mockResolvedValue(modelos()); vi.mocked(abrirCamara).mockReturnValue(pendiente.promesa);
    const controlador = new ControladorVideo(() => v, vi.fn());
    const inicio = controlador.iniciar(); await vi.advanceTimersByTimeAsync(0);
    controlador.detener(); pendiente.resolver(c); await inicio; await Promise.resolve();
    expect(liberarCamara).toHaveBeenCalledWith(c, v); expect(v.play).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('no inicializa si se detiene inmediatamente', async () => {
    const controlador = new ControladorVideo(video, vi.fn());
    const inicio = controlador.iniciar(); controlador.detener(); await inicio;
    expect(cargarModelos).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it('permite tres ensayos y reiniciar, sin acumular temporizadores', async () => {
    vi.mocked(cargarModelos).mockImplementation(async () => modelos());
    vi.mocked(abrirCamara).mockImplementation(async () => camara());
    const controlador = new ControladorVideo(video, vi.fn());
    for (let i = 0; i < 3; i++) { await controlador.iniciar(); expect(vi.getTimerCount()).toBe(1); controlador.detener(); }
    await controlador.reiniciar(); controlador.destruir();
    expect(cargarModelos).toHaveBeenCalledTimes(4); expect(vi.getTimerCount()).toBe(0);
  });
  it('rechazos devuelven eventos vacíos y permiten reintentar', async () => {
    const publicar = vi.fn<(vista: VistaVideo) => void>();
    vi.mocked(cargarModelos).mockRejectedValueOnce(new Error('WebGL')).mockResolvedValue(modelos());
    vi.mocked(abrirCamara).mockResolvedValue(camara());
    const controlador = new ControladorVideo(video, publicar);
    await expect(controlador.iniciar()).resolves.toBeUndefined();
    expect(publicar.mock.lastCall?.[0].estado).toBe('error'); expect(controlador.detener()).toEqual([]);
    await controlador.iniciar(); expect(publicar.mock.lastCall?.[0].estado).toBe('listo'); controlador.destruir();
  });
  it('una carga bloqueada tiene timeout y cierra el modelo tardío', async () => {
    const pendiente = diferido<Modelos>(), m = modelos(), publicar = vi.fn();
    vi.mocked(cargarModelos).mockReturnValue(pendiente.promesa);
    const controlador = new ControladorVideo(video, publicar);
    const inicio = controlador.iniciar(); await vi.advanceTimersByTimeAsync(20_001); await inicio;
    expect(publicar.mock.lastCall?.[0].estado).toBe('error');
    pendiente.resolver(m); await vi.advanceTimersByTimeAsync(0);
    expect(cerrarModelos).toHaveBeenCalledWith(m); expect(abrirCamara).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('un error durante inferencia no escapa del bucle y libera recursos', async () => {
    const m = modelos(); vi.mocked(m.rostro.detectForVideo).mockImplementation(() => { throw new Error('context lost'); });
    vi.mocked(cargarModelos).mockResolvedValue(m); vi.mocked(abrirCamara).mockResolvedValue(camara());
    const publicar = vi.fn(), controlador = new ControladorVideo(video, publicar);
    await controlador.iniciar(); await vi.advanceTimersByTimeAsync(201);
    expect(publicar.mock.lastCall?.[0].estado).toBe('error'); expect(controlador.detener()).toEqual([]);
    expect(cerrarModelos).toHaveBeenCalledWith(m); expect(vi.getTimerCount()).toBe(0);
  });
  it('el mock usa la misma interfaz y no pide cámara ni modelos', async () => {
    const controlador = new ControladorVideo(() => null, vi.fn(), true);
    await controlador.iniciar(); await vi.advanceTimersByTimeAsync(8000);
    expect(controlador.detener()).toHaveLength(1); expect(controlador.detener()).toHaveLength(1);
    await controlador.reiniciar(); expect(controlador.detener()).toEqual([]);
    expect(cargarModelos).not.toHaveBeenCalled(); expect(abrirCamara).not.toHaveBeenCalled();
  });
});
