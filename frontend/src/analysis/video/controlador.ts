import type { Evento } from '../../types';
import { VIDEO_CONFIG as C } from './config';
import { vistaInicial, type VistaVideo } from './interfaces';
import { abrirCamara, liberarCamara, mensajeError, type CamaraVideo } from './camara';
import { cargarModelos, cerrarModelos, type Modelos } from './mediapipe';
import { MotorVideo } from './motor';
import { eventosMock, vistaMock } from './mock';

/** El token de sesión invalida permisos/modelos que resuelvan después de detener. */
export class ControladorVideo {
  private token = 0;
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendiente: Promise<void> | null = null;
  private modelos: Modelos | null = null;
  private camara: CamaraVideo | null = null;
  private video: HTMLVideoElement | null = null;
  private motor = new MotorVideo();
  private inicio = 0;
  private ultimoFrame = -1;
  private ultimoFrameEn = 0;
  private activo = false;
  private fallo = false;
  private finales: Evento[] = [];

  constructor(private readonly obtenerVideo: () => HTMLVideoElement | null,
    private readonly publicar: (vista: VistaVideo) => void, private readonly mock = C.mock as boolean) {}

  iniciar(): Promise<void> {
    if (this.pendiente) return this.pendiente;
    if (this.activo) return Promise.resolve();
    const token = ++this.token;
    this.motor = new MotorVideo(); this.finales = []; this.fallo = false;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.publicar({ ...vistaInicial(), estado: 'cargando', aviso: 'Preparando análisis de video…' });
    const tarea = Promise.resolve().then(() => this.preparar(token, signal));
    this.pendiente = tarea;
    void tarea.finally(() => { if (this.token === token) this.pendiente = null; });
    return tarea;
  }

  private async preparar(token: number, signal: AbortSignal): Promise<void> {
    if (token !== this.token || signal.aborted) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancelar: (() => void) | undefined;
    try {
      if (this.mock) {
        this.inicio = performance.now(); this.activo = true; this.publicar(vistaMock()); return;
      }
      this.video = this.obtenerVideo();
      if (!this.video) throw new Error('Elemento video no disponible.');
      const video = this.video;
      const limite = new Promise<never>((_, rechazar) => {
        timeout = setTimeout(() => rechazar(new Error('Tiempo de preparación agotado.')), C.timeoutMs);
        cancelar = () => rechazar(new Error('Sesión cancelada.'));
        signal.addEventListener('abort', cancelar, { once: true });
      });
      const preparar = async () => {
        const modelos = await cargarModelos(signal);
        if (token !== this.token || signal.aborted) { cerrarModelos(modelos); return; }
        this.modelos = modelos;
        const camara = await abrirCamara(video, signal);
        if (token !== this.token || signal.aborted) { liberarCamara(camara, video); return; }
        this.camara = camara;
        video.muted = true; video.playsInline = true;
        await video.play();
      };
      await Promise.race([preparar(), limite]);
      if (token !== this.token || signal.aborted) return;
      this.inicio = performance.now(); this.ultimoFrameEn = this.inicio; this.ultimoFrame = -1; this.activo = true;
      this.publicar({ ...vistaInicial(), calibrando: true, aviso: 'Mira a la cámara y mantén los hombros visibles durante 3 segundos.' });
      this.programar(token);
    } catch (error) {
      if (token === this.token) this.fallar(mensajeError(error));
    } finally {
      clearTimeout(timeout);
      if (cancelar) signal.removeEventListener('abort', cancelar);
    }
  }

  private programar(token: number): void {
    this.timer = setTimeout(() => this.procesar(token), 1000 / C.fps);
  }

  private procesar(token: number): void {
    if (!this.activo || token !== this.token) return;
    try {
      const video = this.video, modelos = this.modelos;
      if (!video || !modelos) throw new Error('Sesión no disponible.');
      if (!this.camara?.stream.getVideoTracks().some(t => t.readyState === 'live')) throw new Error('Cámara desconectada.');
      const ahora = performance.now();
      if (video.readyState >= 2 && video.currentTime !== this.ultimoFrame) {
        this.ultimoFrame = video.currentTime; this.ultimoFrameEn = ahora;
        const rostro = modelos.rostro.detectForVideo(video, ahora);
        const pose = modelos.pose.detectForVideo(video, ahora);
        let resultado: ReturnType<MotorVideo['procesar']>;
        try { resultado = this.motor.procesar(rostro, pose, (ahora - this.inicio) / 1000); }
        finally { pose.close(); }
        if (resultado.falloCalibracion) {
          this.fallar('No se logró calibrar. Mejora la luz y mira a la cámara; puedes continuar sin análisis de video.'); return;
        }
        this.publicar({ estado: 'listo', error: null, calibrando: resultado.calibrando, fiable: resultado.fiable, metricas: resultado.metricas,
          aviso: resultado.calibrando ? 'Mira a la cámara y mantén los hombros visibles durante 3 segundos.'
            : !resultado.fiable ? 'Señal poco fiable: no se penalizan los puntos que no se pueden medir.'
            : modelos.cpu ? 'Análisis activo en CPU.' : null,
          landmarks: { rostro: rostro.faceLandmarks[0] ?? [], pose: pose.landmarks[0] ?? [] } });
      } else if (ahora - this.ultimoFrameEn > C.cuadrosAusentesMs) throw new Error('No llegan cuadros de cámara.');
      this.programar(token);
    } catch (error) { this.fallar(mensajeError(error)); }
  }

  private liberar(): void {
    ++this.token;
    this.abort?.abort(); this.abort = null;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    cerrarModelos(this.modelos); this.modelos = null;
    liberarCamara(this.camara, this.video); this.camara = null; this.video = null;
    this.activo = false; this.pendiente = null;
  }
  private fallar(mensaje: string): void {
    this.fallo = true; this.finales = []; this.motor = new MotorVideo(); this.liberar();
    this.publicar({ ...vistaInicial(), estado: 'error', error: mensaje, aviso: mensaje });
  }
  detener(): Evento[] {
    if (this.activo && !this.fallo) this.finales = this.mock
      ? eventosMock((performance.now() - this.inicio) / 1000) : this.motor.detener();
    this.liberar();
    if (!this.fallo) this.publicar({ ...vistaInicial(), aviso: 'Análisis detenido.' });
    return this.finales.map(e => ({ ...e }));
  }
  async reiniciar(): Promise<void> { this.detener(); await this.iniciar(); }
  /** La grabación puede tardar en arrancar después de preparar los modelos. */
  sincronizarInicio(inicioMs: number): void {
    if (!this.activo || this.fallo || !Number.isFinite(inicioMs) || inicioMs < 0 || inicioMs > performance.now()) return;
    this.inicio = inicioMs;
    this.motor = new MotorVideo(); this.finales = [];
    this.publicar(this.mock ? vistaMock() : { ...vistaInicial(), calibrando: true,
      aviso: 'Mira a la cámara y mantén los hombros visibles durante 3 segundos.' });
  }
  destruir(): void { this.liberar(); this.motor = new MotorVideo(); this.finales = []; }
}
