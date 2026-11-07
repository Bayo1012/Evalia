import type { BaseVideo } from "../analysis/video/calibracion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Camera,
  Eye,
  LockKeyhole,
  Mic,
  RotateCcw,
  Square,
  PersonStanding,
} from "lucide-react";
import type { Contexto, Intento } from "../types";
import {
  Acompanante,
  Barra,
  Boton,
  Mensaje,
  Tarjeta,
  tiempo,
} from "../components/ui";
import CamaraDemo from "../components/CamaraDemo";
import { nombresJurado } from "./Inicio";
import {
  obtenerAdaptadorAudio,
  liberarStream,
  type SesionAudio,
  type MetricasAudio,
} from "../integrations/audio";
import { useAnalisisVideo, dibujarLandmarks } from "../analysis/video";
interface Props {
  baseVideo?: BaseVideo | null;
  omitirVideo?: boolean;
  intentoInicial?: Intento | null;
  demo: boolean;
  contexto: Contexto;
  stream: MediaStream | null;
  onStream: (s: MediaStream | null) => void;
  onAnalizar: (i: Intento) => Promise<void>;
  cargando: boolean;
  error: string;
  onLimpiarError: () => void;
  fallar: boolean;
  onFallar: (v: boolean) => void;
}
export default function Grabacion(p: Props) {
  const [estado, setEstado] = useState<"preparando" | "grabando" | "revision">(
    p.intentoInicial ? "revision" : "preparando",
  );
  const [segundos, setSegundos] = useState(Math.floor(p.intentoInicial?.duracion ?? 0));
  const [intento, setIntento] = useState<Intento | null>(p.intentoInicial ?? null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [audio, setAudio] = useState<MetricasAudio>({
    volumen: null,
    ritmo: null,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sesion = useRef<SesionAudio | null>(null);
  const streamRef = useRef(p.stream);
  const inicio = useRef(0);
  const bloqueo = useRef(false);
  const vivo = useRef(true);
  const analisis = useAnalisisVideo(videoRef, { mock: p.demo, base: p.baseVideo });
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      // StrictMode vuelve a montar los efectos: no apagar el stream prestado en ese ensayo.
      queueMicrotask(() => {
        if (vivo.current) return;
        try { sesion.current?.cancelar(); } catch { /* continuar con la limpieza */ }
        liberarStream(streamRef.current);
      });
    };
  }, []);
  useEffect(() => {
    let cancelado = false;
    if (p.demo && !p.intentoInicial) {
      void analisis.iniciar().then(() => {
        if (cancelado || !vivo.current) return;
        inicio.current = performance.now();
        analisis.sincronizarInicio(inicio.current);
        setEstado("grabando");
      });
    }
    return () => { cancelado = true; };
  }, [p.demo, p.intentoInicial, analisis.iniciar, analisis.sincronizarInicio]);
  useEffect(() => {
    if (videoRef.current && p.stream) videoRef.current.srcObject = p.stream;
    streamRef.current = p.stream;
  }, [p.stream, estado]);
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;
    canvasRef.current.width = videoRef.current.videoWidth || 640;
    canvasRef.current.height = videoRef.current.videoHeight || 480;
    dibujarLandmarks(canvasRef.current, analisis.landmarks);
  }, [analisis.landmarks]);
  useEffect(() => {
    if (estado !== "grabando") return;
    const timer = setInterval(
      () =>
        setSegundos(
          Math.min(
            600,
            Math.floor((performance.now() - inicio.current) / 1000),
          ),
        ),
      250,
    );
    return () => clearInterval(timer);
  }, [estado]);
  useEffect(() => {
    if (segundos >= 600 && estado === "grabando") void detener();
  }, [segundos, estado]);
  async function comenzarReal() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      const adaptador = obtenerAdaptadorAudio();
      if (!adaptador)
        throw new Error("El módulo de audio todavía no está conectado.");
      let stream = streamRef.current;
      if (!stream || !stream.getAudioTracks().some(t => t.readyState === "live")
        || !stream.getVideoTracks().some(t => t.readyState === "live")) {
        liberarStream(stream);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        if (!vivo.current) {
          liberarStream(stream);
          return;
        }
        streamRef.current = stream;
        p.onStream(stream);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (!p.omitirVideo) await analisis.iniciar();
      if (!vivo.current) return;
      const nueva = await adaptador.iniciar(stream, (m) => {
        if (vivo.current) setAudio(m);
      });
      if (!vivo.current) {
        nueva.cancelar();
        return;
      }
      sesion.current = nueva;
      inicio.current = performance.now();
      analisis.sincronizarInicio(inicio.current);
      setSegundos(0);
      setEstado("grabando");
    } catch (e) {
      if (!vivo.current) return;
      setError(
        e instanceof Error ? e.message : "No pudimos iniciar la grabación.",
      );
      analisis.detener();
      liberarStream(streamRef.current);
      streamRef.current = null;
      p.onStream(null);
    } finally {
      bloqueo.current = false;
      if (vivo.current) setOcupado(false);
    }
  }
  async function detener() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    const duracion = Math.min(600, Math.max(0, (performance.now() - inicio.current) / 1000));
    try {
      const eventos = analisis.detener();
      const resultado = await sesion.current?.detener();
      sesion.current = null;
      if (!vivo.current) return;
      setIntento({
        audio: resultado?.audio,
        video: resultado?.video,
        eventos: [...eventos, ...(resultado?.eventos ?? [])].sort((a, b) => a.t - b.t),
        duracion,
      });
      setSegundos(Math.floor(duracion));
      setEstado("revision");
    } catch (e) {
      if (!vivo.current) return;
      try { sesion.current?.cancelar(); } catch { /* liberar los tracks igualmente */ }
      setEstado("preparando");
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos terminar la grabación. Vuelve a intentarlo.",
      );
    } finally {
      sesion.current = null;
      liberarStream(streamRef.current);
      streamRef.current = null;
      if (vivo.current) { p.onStream(null); setOcupado(false); }
      bloqueo.current = false;
    }
  }
  async function descartar() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    try { sesion.current?.cancelar(); } catch { /* continuar con el descarte */ }
    sesion.current = null;
    analisis.detener();
    setIntento(null);
    setSegundos(0);
    setError("");
    setAudio({ volumen: null, ritmo: null });
    p.onLimpiarError();
    if (p.demo) await analisis.reiniciar();
    if (!vivo.current) { bloqueo.current = false; return; }
    inicio.current = performance.now();
    if (p.demo) analisis.sincronizarInicio(inicio.current);
    setEstado(p.demo ? "grabando" : "preparando");
    setOcupado(false);
    bloqueo.current = false;
  }
  const volumen = p.demo ? 64 : audio.volumen;
  const ritmo = p.demo ? 128 : audio.ritmo;
  const medicionVideo = estado === "grabando" && analisis.fiable;
  const mirada = analisis.metricas.contactoVisual;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {estado === "revision"
              ? "TU ENSAYO ESTÁ LISTO"
              : "TU MOMENTO, SIN PRESIÓN"}
          </span>
          <h1>
            {estado === "revision"
              ? "Una pausa para descubrir."
              : "Dale voz a tu idea."}
          </h1>
          <p>{p.contexto.presentacion}</p>
        </div>
        <span className="pill">
          Jurado: <strong>{nombresJurado[p.contexto.jurado]}</strong>
        </span>
      </div>
      <div className="recording-grid">
        <div>
          <div className="camera-stage">
            {p.demo ? (
              <CamaraDemo revision={estado === "revision"} />
            ) : estado === "revision" ? (
              <div className="no-video">
                <Camera />
                <h3>Grabación lista para analizar</h3>
                <p>Podrás reproducir tu ensayo junto a los momentos señalados en el reporte.</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="live-video"
                />
                <canvas ref={canvasRef} className="body-overlay" />
              </>
            )}
            <div className="camera-top">
              <span className="pill">
                <span className="status-dot" />
                {p.demo
                  ? "VISTA SIMULADA"
                  : estado === "revision"
                    ? "GRABACIÓN FINALIZADA"
                    : "CÁMARA LOCAL"}
              </span>
              <span className="camera-tip">
                {estado === "grabando"
                  ? "Mira a la cámara. Confía en tu idea."
                  : "Tú decides cuándo analizar."}
              </span>
            </div>
            {estado === "grabando" && (
              <div className="record-controls">
                <span className="timer">
                  <i />
                  {tiempo(segundos)}
                </span>
                <Boton variante="danger" disabled={ocupado} onClick={() => void detener()}>
                  <Square size={15} fill="currentColor" /> Detener grabación
                </Boton>
              </div>
            )}
          </div>
          <div className="record-foot">
            <span>
              <LockKeyhole size={14} />{" "}
              {p.demo
                ? "No se está grabando audio ni video"
                : "Tu video no sale del dispositivo"}
            </span>
            <span>Límite: 10:00</span>
          </div>
          {estado === "preparando" && !p.demo && (
            <Boton disabled={ocupado} onClick={() => void comenzarReal()}>
              <Mic size={17} /> {ocupado ? "Preparando cámara y análisis…" : "Iniciar grabación real"}
            </Boton>
          )}
          {!p.demo && p.omitirVideo && <Mensaje>Continuaste sin análisis de video. La cámara y el audio siguen disponibles.</Mensaje>}
          {(error || (!p.demo && analisis.error)) && (
            <Mensaje error>{error || analisis.error}</Mensaje>
          )}
          {!p.demo && !analisis.error && analisis.aviso && estado !== "revision" && (
            <Mensaje>{analisis.aviso}</Mensaje>
          )}
          {estado === "revision" && (
            <Tarjeta className="review-card">
              <div>
                <span className="eyebrow">ANTES DE CONTINUAR</span>
                <h2>¿Descubrimos cómo te fue?</h2>
                <p>
                  {p.demo
                    ? "Verás un reporte fijo de ejemplo de 3 minutos, independiente del cronómetro."
                    : "Al confirmar se enviarán el audio y los eventos al backend para analizarlos."}
                </p>
              </div>
              {p.error && <Mensaje error>{p.error}</Mensaje>}
              {!p.cargando && (
                <div className="actions">
                  <Boton onClick={() => intento && void p.onAnalizar(intento)}>
                    {p.error ? "Reintentar análisis" : "Analizar ensayo"}
                    <ArrowRight size={17} />
                  </Boton>
                  <Boton variante="secondary" disabled={ocupado} onClick={() => void descartar()}>
                    <RotateCcw size={16} />
                    Descartar y volver a grabar
                  </Boton>
                </div>
              )}
              {p.demo && (
                <label className="test-switch">
                  <input
                    type="checkbox"
                    checked={p.fallar}
                    disabled={p.cargando}
                    onChange={(e) => p.onFallar(e.target.checked)}
                  />{" "}
                  Simular error en el próximo análisis (solo una vez)
                </label>
              )}
            </Tarjeta>
          )}
        </div>
        <Tarjeta className="metrics-panel">
          <Acompanante>Respira, vas a tu ritmo.</Acompanante>
          <div className="metrics-heading">
            <div>
              <span className="eyebrow">
                {p.demo ? "INDICADORES SIMULADOS" : "ANÁLISIS EN VIVO"}
              </span>
              <h2>
                {estado === "revision"
                  ? "Ensayo terminado"
                  : "Todo empieza contigo"}
              </h2>
            </div>
            <AudioLines size={23} />
          </div>
          <div className="metric">
            <div className="metric-label">
              <span>
                <Mic size={17} />
                Volumen
              </span>
              <strong>
                {volumen === null ? "Sin medición" : `${volumen}%`}
              </strong>
            </div>
            <div className="wave-bars" aria-hidden="true">
              {Array.from({ length: 18 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    height: `${8 + ((i * 17 + 11) % 36)}px`,
                    opacity:
                      volumen === null
                        ? 0.2
                        : i / 18 < volumen / 100
                          ? 1
                          : 0.25,
                  }}
                />
              ))}
            </div>
            <div className="range-labels">
              <span>Bajo</span>
              <span>Alto</span>
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">
              <span>
                <AudioLines size={17} />
                Ritmo al hablar
              </span>
            </div>
            <div className="metric-value">
              {ritmo ?? "—"}
              <small>palabras/min</small>
            </div>
            {ritmo !== null && <Barra valor={Math.min(100, ritmo / 1.8)} />}
            <p>
              {p.demo
                ? "Un ritmo tranquilo da espacio a tus ideas."
                : "El ritmo se calcula al transcribir el audio en el reporte."}
            </p>
          </div>
          <div className="metric">
            <div className="metric-label">
              <span>
                <Eye size={17} />
                Orientación a la cámara
              </span>
              <strong>
                {medicionVideo ? `${mirada}%` : "Sin medición"}
              </strong>
            </div>
            {medicionVideo && <Barra valor={mirada} />}
            <p>Una mirada al frente conecta con tu audiencia.</p>
          </div>
          <div className="metric posture">
            <PersonStanding size={28} />
            <div>
              <strong>
                {p.demo && medicionVideo
                  ? "Postura estable"
                  : !medicionVideo
                    ? "Esperando medición"
                    : `Estabilidad: ${analisis.metricas.postura}%`}
              </strong>
              <p>
                {p.demo
                  ? "Hombros alineados · Simulado"
                  : "Estimación local de postura"}
              </p>
            </div>
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
