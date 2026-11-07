import type { AdaptadorAudio } from './audio';
import type { Evento } from '../types';

// El audio se envía al backend; la copia de video con sonido permanece en memoria local.
export const grabadorAudio: AdaptadorAudio = {
  async iniciar(stream, publicar) {
    if (!stream.getAudioTracks().some(t => t.readyState === 'live'))
      throw new Error('No hay un micrófono activo. Vuelve a dar permisos.');
    const soloAudio = new MediaStream(stream.getAudioTracks());
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find(tipo => MediaRecorder.isTypeSupported(tipo));
    const grabador = new MediaRecorder(soloAudio, mimeType ? { mimeType } : undefined);
    const reproductor = document.createElement('video');
    const tipoVideo = ['video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm']
      .find(tipo => MediaRecorder.isTypeSupported(tipo) && reproductor.canPlayType(tipo) !== '');
    const grabadorVideo = stream.getVideoTracks().some(t => t.readyState === 'live')
      ? new MediaRecorder(stream, tipoVideo ? { mimeType: tipoVideo } : undefined)
      : null;
    const partesVideo: Blob[] = [];
    if (grabadorVideo) grabadorVideo.ondataavailable = e => { if (e.data.size) partesVideo.push(e.data); };
    const contexto = new AudioContext();
    try { await contexto.resume(); } catch (error) { await contexto.close(); throw error; }
    const fuente = contexto.createMediaStreamSource(soloAudio);
    const analizador = contexto.createAnalyser();
    analizador.fftSize = 2048;
    fuente.connect(analizador);
    const muestras = new Float32Array(analizador.fftSize);
    const partes: Blob[] = [];
    const eventos: Evento[] = [];
    const inicio = performance.now();
    let silencio: number | null = null;
    let pausaEmitida = false;
    let cerrado = false;
    let fallo: Error | null = null;
    const limpiar = () => {
      clearInterval(timer);
      fuente.disconnect();
      void contexto.close();
    };
    grabador.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
    grabador.onerror = () => { fallo = new Error('Falló la grabación del micrófono. Vuelve a grabar.'); };
    if (grabadorVideo) grabadorVideo.onerror = () => { fallo = new Error('Falló la grabación local del video. Vuelve a grabar.'); };
    const finalizar = (recorder: MediaRecorder, partesGrabadas: Blob[]) => new Promise<Blob>(resolve => {
      const completar = () => resolve(new Blob(partesGrabadas, { type: recorder.mimeType }));
      recorder.onstop = completar;
      if (recorder.state === 'inactive') completar();
      else recorder.stop();
    });
    const timer = setInterval(() => {
      analizador.getFloatTimeDomainData(muestras);
      const rms = Math.sqrt(muestras.reduce((s, v) => s + v * v, 0) / muestras.length);
      const t = (performance.now() - inicio) / 1000;
      publicar({ volumen: Math.min(100, Math.round(rms * 400)), ritmo: null });
      if (rms < 0.01) {
        silencio ??= t;
        if (t - silencio >= 3 && !pausaEmitida) {
          eventos.push({ t, tipo: 'pausa_larga', origen: 'audio', detalle: 'Silencio de más de 3 segundos' });
          pausaEmitida = true;
        }
      } else { silencio = null; pausaEmitida = false; }
    }, 200);
    try {
      grabador.start(1000);
      grabadorVideo?.start(1000);
    } catch (error) {
      if (grabador.state !== 'inactive') grabador.stop();
      if (grabadorVideo && grabadorVideo.state !== 'inactive') grabadorVideo.stop();
      limpiar();
      throw error;
    }
    return {
      async detener() {
        if (cerrado) throw new Error('La grabación ya terminó.');
        cerrado = true;
        try {
          const [audio, video] = await Promise.all([
            finalizar(grabador, partes),
            grabadorVideo ? finalizar(grabadorVideo, partesVideo) : Promise.resolve(undefined),
          ]);
          if (fallo) throw fallo;
          return { audio, video, eventos };
        } finally { limpiar(); }
      },
      cancelar() {
        if (cerrado) return;
        cerrado = true;
        grabador.ondataavailable = null;
        if (grabadorVideo) {
          grabadorVideo.ondataavailable = null;
          if (grabadorVideo.state !== 'inactive') grabadorVideo.stop();
        }
        if (grabador.state !== 'inactive') grabador.stop();
        limpiar();
      },
    };
  },
};
