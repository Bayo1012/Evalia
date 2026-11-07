import { useEffect, useRef } from 'react';
import { useAnalisisVideo, dibujarLandmarks } from '../analysis/video';
import type { BaseVideo } from '../analysis/video/calibracion';
import { Boton, Mensaje } from './ui';

export default function CalibracionInicial({ stream, onLista, onOmitir }: {
  stream: MediaStream;
  onLista: (base: BaseVideo) => void;
  onOmitir: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const entregada = useRef(false);
  const analisis = useAnalisisVideo(video, { mock: false });
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
    void analisis.iniciar();
  }, [stream, analisis.iniciar]);
  useEffect(() => {
    if (!canvas.current || !video.current) return;
    canvas.current.width = video.current.videoWidth || 640;
    canvas.current.height = video.current.videoHeight || 480;
    dibujarLandmarks(canvas.current, analisis.landmarks);
    const base = analisis.obtenerBase();
    if (base && !entregada.current) {
      entregada.current = true;
      onLista(base);
    }
  }, [analisis.landmarks, analisis.obtenerBase, onLista]);
  return <div>
    <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', borderRadius: 16, marginTop: 16 }}>
      <video ref={video} autoPlay muted playsInline aria-label="Vista previa para calibrar la cámara"
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      <canvas ref={canvas} className="body-overlay" />
    </div>
    <Mensaje error={!!analisis.error}>
      {entregada.current ? 'Calibración lista. Puedes comenzar el ensayo cuando quieras.'
        : analisis.error || analisis.aviso || 'Preparando calibración…'}
    </Mensaje>
    {analisis.error && <Boton type="button" variante="secondary" onClick={() => {
      entregada.current = false;
      void analisis.reiniciar();
    }}>Reintentar calibración</Boton>}
    {!entregada.current && <Boton type="button" variante="secondary" onClick={onOmitir}>
      Continuar sin análisis de video
    </Boton>}
  </div>;
}
