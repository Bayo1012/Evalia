import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarModelos, cerrarModelos } from './mediapipe';
import { FaceLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';

vi.mock('@mediapipe/tasks-vision', () => ({ FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  FaceLandmarker: { createFromOptions: vi.fn() }, PoseLandmarker: { createFromOptions: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('carga de modelos', () => {
  it('cierra el rostro GPU parcial y usa CPU para ambos modelos', async () => {
    const rostroGpu = { close: vi.fn() }, rostroCpu = { close: vi.fn() }, poseCpu = { close: vi.fn() };
    vi.mocked(FaceLandmarker.createFromOptions).mockResolvedValueOnce(rostroGpu as unknown as FaceLandmarker)
      .mockResolvedValueOnce(rostroCpu as unknown as FaceLandmarker);
    vi.mocked(PoseLandmarker.createFromOptions).mockRejectedValueOnce(new Error('WebGL'))
      .mockResolvedValueOnce(poseCpu as unknown as PoseLandmarker);
    const m = await cargarModelos(new AbortController().signal);
    expect(m.cpu).toBe(true); expect(rostroGpu.close).toHaveBeenCalledOnce();
    expect(FaceLandmarker.createFromOptions).toHaveBeenLastCalledWith({}, expect.objectContaining({
      baseOptions: expect.objectContaining({ delegate: 'CPU' }) }));
    cerrarModelos(m); expect(rostroCpu.close).toHaveBeenCalledOnce(); expect(poseCpu.close).toHaveBeenCalledOnce();
  });
  it('cancelar durante carga libera el modelo recién creado', async () => {
    const abort = new AbortController(), rostro = { close: vi.fn() };
    vi.mocked(FaceLandmarker.createFromOptions).mockImplementationOnce(async () => {
      abort.abort(); return rostro as unknown as FaceLandmarker;
    });
    await expect(cargarModelos(abort.signal)).rejects.toBeDefined();
    expect(rostro.close).toHaveBeenCalledOnce(); expect(PoseLandmarker.createFromOptions).not.toHaveBeenCalled();
  });
});
