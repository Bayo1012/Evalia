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
  Cargando,
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
    "preparando",
  );
  const [segundos, setSegundos] = useState(0);
  const [intento, setIntento] = useState<Intento | null>(null);
  const [error, setError] = useState("");
  const [audio, setAudio] = useState<MetricasAudio>({
    volumen: null,
    ritmo: null,
  });
  const [revisionUrl, setRevisionUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sesion = useRef<SesionAudio | null>(null);
  const streamRef = useRef(p.stream);
  const inicio = useRef(0);
  const bloqueo = useRef(false);
  const vivo = useRef(true);
  const analisis = useAnalisisVideo(videoRef, { mock: p.demo });
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      sesion.current?.cancelar();
      liberarStream(streamRef.current);
    };
  }, []);
  useEffect(() => {
    if (p.demo) {
      inicio.current = performance.now();
      setEstado("grabando");
    }
  }, [p.demo]);
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
    if (!intento?.video) {
      setRevisionUrl("");
      return;
    }
    const url = URL.createObjectURL(intento.video);
    setRevisionUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [intento]);
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
    setError("");
    try {
      const adaptador = obtenerAdaptadorAudio();
      if (!adaptador)
        throw new Error("El módulo de audio todavía no está conectado.");
      let stream = streamRef.current;
      if (!stream?.getTracks().every((t) => t.readyState === "live")) {
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
        await videoRef.current.play();
      }
      await analisis.iniciar();
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
      setSegundos(0);
      setEstado("grabando");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos iniciar la grabación.",
      );
      analisis.detener();
      liberarStream(streamRef.current);
      streamRef.current = null;
      p.onStream(null);
    } finally {
      bloqueo.current = false;
    }
  }
  async function detener() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    try {
      const eventos = analisis.detener();
      const resultado = await sesion.current?.detener();
      sesion.current = null;
      setIntento({
        audio: resultado?.audio,
        video: resultado?.video,
        eventos: [...eventos, ...(resultado?.eventos ?? [])],
        duracion: segundos,
      });
      setEstado("revision");
      liberarStream(streamRef.current);
      streamRef.current = null;
      p.onStream(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos terminar la grabación. Vuelve a intentarlo.",
      );
    } finally {
      bloqueo.current = false;
    }
  }
  function descartar() {
    sesion.current?.cancelar();
    sesion.current = null;
    analisis.detener();
    setIntento(null);
    setSegundos(0);
    setError("");
    setAudio({ volumen: null, ritmo: null });
    p.onLimpiarError();
    inicio.current = performance.now();
    setEstado(p.demo ? "grabando" : "preparando");
  }
  const volumen = p.demo ? 64 : audio.volumen;
  const ritmo = p.demo ? 128 : audio.ritmo;
  const mirada = p.demo ? 72 : analisis.metricas.contactoVisual;
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
              revisionUrl ? (
                <video className="local-video" src={revisionUrl} controls />
              ) : (
                <div className="no-video">
                  <Camera />
                  <h3>Audio listo para analizar</h3>
                  <p>Este intento no tiene video local.</p>
                </div>
              )
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
                <Boton variante="danger" onClick={() => void detener()}>
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
          {estado === "preparando" && (
            <Boton onClick={() => void comenzarReal()}>
              <Mic size={17} /> Iniciar grabación real
            </Boton>
          )}
          {(error || (!p.demo && analisis.error)) && (
            <Mensaje error>{error || analisis.error}</Mensaje>
          )}
          {!p.demo && analisis.aviso && estado === "grabando" && (
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
              {p.cargando ? (
                <Cargando />
              ) : (
                <div className="actions">
                  <Boton onClick={() => intento && void p.onAnalizar(intento)}>
                    {p.error ? "Reintentar análisis" : "Analizar ensayo"}
                    <ArrowRight size={17} />
                  </Boton>
                  <Boton variante="secondary" onClick={descartar}>
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
                : "El ritmo estará disponible desde el módulo de audio."}
            </p>
          </div>
          <div className="metric">
            <div className="metric-label">
              <span>
                <Eye size={17} />
                Orientación a la cámara
              </span>
              <strong>
                {p.demo
                  ? `${mirada}%`
                  : analisis.aviso
                    ? "Sin medición"
                    : `${mirada}%`}
              </strong>
            </div>
            <Barra valor={mirada} />
            <p>Una mirada al frente conecta con tu audiencia.</p>
          </div>
          <div className="metric posture">
            <PersonStanding size={28} />
            <div>
              <strong>
                {p.demo
                  ? "Postura estable"
                  : analisis.aviso
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
