import type { FaceLandmarkerResult, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Evento } from '../../types';
import { VIDEO_CONFIG as C } from './config';
import { actualizarCalibracion, type BaseVideo, type MuestraBase } from './calibracion';
import { extraerRostro, desviacionMirada, miradaDesviada } from './faceAnalyzer';
import { extraerPostura, manosOcultas, ventanaPostura, balanceo, type MuestraPostura } from './poseAnalyzer';
import { avanzarEpisodio, cerrarEpisodio, episodioVacio, suavizar, promedio, histeresis, type TipoVideo } from './eventos';

export class MotorVideo {
  private base: BaseVideo | null = null;
  private muestras: MuestraBase[] = [];
  private mirada: number[] = [];
  private postura: MuestraPostura[] = [];
  private ultimoRostro = -Infinity;
  private ultimaPostura = -Infinity;
  private desviado = false;
  private inestable = false;
  private episodios = { mirada_baja: episodioVacio(), postura_inestable: episodioVacio(), manos_ocultas: episodioVacio() };
  private eventos: Evento[] = [];

  constructor(base: BaseVideo | null = null) { this.base = base; }

  obtenerBase(): BaseVideo | null { return this.base; }

  procesar(rostro: FaceLandmarkerResult, pose: PoseLandmarkerResult, t: number) {
    const cara = extraerRostro(rostro);
    const puntos = pose.landmarks[0] ?? [];
    const cuerpo = extraerPostura(puntos);
    if (!this.base) {
      const resultado = actualizarCalibracion(this.muestras, cara && cuerpo ? { t, rostro: cara, postura: cuerpo } : null, t);
      this.muestras = resultado.muestras;
      this.base = resultado.base;
      return { calibrando: !this.base, falloCalibracion: !this.base && t >= C.calibracionLimiteSegundos,
        fiable: false, metricas: { contactoVisual: 0, postura: 0 } };
    }
    let miradaActiva: boolean | null = null, posturaActiva: boolean | null = null;
    if (t - this.ultimoRostro > C.huecoMaximo) { this.mirada = []; this.desviado = false; }
    if (t - this.ultimaPostura > C.huecoMaximo) { this.postura = []; this.inestable = false; }
    if (cara) {
      this.ultimoRostro = t;
      this.mirada = suavizar(this.mirada, desviacionMirada(cara, this.base.rostro));
      this.desviado = miradaDesviada(promedio(this.mirada), this.desviado);
      miradaActiva = this.desviado;
    }
    if (cuerpo) {
      this.ultimaPostura = t;
      this.postura = ventanaPostura(this.postura, cuerpo, this.base.postura, t);
      this.inestable = histeresis(balanceo(this.postura), this.inestable, C.posturaEntrada, C.posturaSalida);
      posturaActiva = this.inestable;
    }
    const activos = { mirada_baja: miradaActiva, postura_inestable: posturaActiva, manos_ocultas: manosOcultas(puntos) };
    for (const tipo of Object.keys(this.episodios) as TipoVideo[]) {
      const resultado = avanzarEpisodio(this.episodios[tipo], activos[tipo], t, tipo);
      this.episodios[tipo] = resultado.estado;
      if (resultado.evento) this.eventos.push(resultado.evento);
    }
    return { calibrando: false, falloCalibracion: false, fiable: !!cara && !!cuerpo,
      metricas: { contactoVisual: cara ? Math.round(100 * Math.max(0, 1 - promedio(this.mirada))) : 0,
        postura: cuerpo ? Math.round(100 * Math.max(0, 1 - balanceo(this.postura) / C.posturaEntrada)) : 0 } };
  }

  detener(): Evento[] {
    for (const tipo of Object.keys(this.episodios) as TipoVideo[]) {
      const evento = cerrarEpisodio(this.episodios[tipo], tipo);
      if (evento) this.eventos.push(evento);
      this.episodios[tipo] = episodioVacio();
    }
    return this.eventos.map(e => ({ ...e })).sort((a, b) => a.t - b.t);
  }
}
