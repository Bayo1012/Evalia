import type { BaseVideo } from "./analysis/video/calibracion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import { Cabecera, Mensaje, Pie } from "./components/ui";
import PantallaCarga from "./components/PantallaCarga";
import { esperarCarga } from "./components/esperarCarga";
import Inicio from "./pages/Inicio";
import Grabacion from "./pages/Grabacion";
import Reporte from "./pages/Reporte";
import Jurado from "./pages/Jurado";
import { contextoDemo, ensayoAnteriorDemo } from "./api/demo";
import { analizarEnsayo } from "./api/services";
import {
  borrarEnsayos,
  guardarEnsayo,
  listarEnsayos,
} from "./storage/historial";
import { liberarStream, obtenerAdaptadorAudio } from "./integrations/audio";
import type { Contexto, Ensayo, Intento, Paso, Repregunta } from "./types";
export default function App() {
  const [baseVideo, setBaseVideo] = useState<BaseVideo | null>(null);
  const [omitirVideo, setOmitirVideo] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [paso, setPaso] = useState<Paso>("inicio");
  const [demo, setDemo] = useState(false);
  const [contexto, setContexto] = useState<Contexto>({ ...contextoDemo });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [historial, setHistorial] = useState(listarEnsayos);
  const [actual, setActual] = useState<Ensayo | null>(null);
  const [anterior, setAnterior] = useState<Ensayo>();
  const [video, setVideo] = useState<Blob>();
  const [intentoAnterior, setIntentoAnterior] = useState<Intento | null>(null);
  const [indiceJurado, setIndiceJurado] = useState(0);
  const [juradoEnviando, setJuradoEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [analizando, setCargando] = useState(false);
  const [preparandoVideo, setPreparandoVideo] = useState(false);
  const cargando = analizando || preparandoVideo;
  const videoListo = useCallback(() => setPreparandoVideo(false), []);
  const videoPreparando = useCallback(() => setPreparandoVideo(true), []);
  const videoFallido = useCallback(() => setPreparandoVideo(false), []);
  const [fallar, setFallar] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState<"inicio" | "reporte" | null>(null);
  const bloqueo = useRef(false);
  const main = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const permisoToken = useRef(0);
  const streamActual = useRef<MediaStream | null>(null);
  useEffect(() => {
    streamActual.current = stream;
  }, [stream]);
  useEffect(
    () => () => {
      permisoToken.current++;
      liberarStream(streamActual.current);
    },
    [],
  );
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    main.current?.focus();
  }, [paso]);
  function persistir(e: Ensayo) {
    try {
      guardarEnsayo(e);
      setHistorial(listarEnsayos());
    } catch {
      setHistorial((h) => [e, ...h.filter((x) => x.id !== e.id)]);
      setAviso(
        "El navegador no permitió guardar los datos. Puedes continuar, pero este ensayo solo estará disponible hasta cerrar la página.",
      );
    }
  }
  function nuevo() {
    setDemo(false);
    setBaseVideo(null);
    setOmitirVideo(false);
    permisoToken.current++;
    liberarStream(stream);
    setStream(null);
    setActual(null);
    setAnterior(undefined);
    setVideo(undefined);
    setIntentoAnterior(null);
    setIndiceJurado(0);
    setError("");
    setConfirmarSalida(null);
    setPaso("inicio");
  }
  function inicio() {
    if (cargando || juradoEnviando) return;
    if (paso === "grabacion" || paso === "jurado") setConfirmarSalida("inicio");
    else nuevo();
  }
  function volver() {
    if (cargando || juradoEnviando) return;
    if (paso === "jurado") setConfirmarSalida("reporte");
    else if (paso === "reporte" && intentoAnterior) {
      setError("");
      setPaso("grabacion");
    } else inicio();
  }
  async function permisos() {
    setBaseVideo(null);
    setOmitirVideo(false);
    const token = ++permisoToken.current;
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("La cámara requiere localhost o una conexión HTTPS.");
      const s = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      if (token !== permisoToken.current) {
        liberarStream(s);
        return;
      }
      liberarStream(streamActual.current);
      setStream(s);
      streamActual.current = s;
    } catch (e) {
      if (token === permisoToken.current)
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "No se concedieron los permisos. Puedes habilitarlos en tu navegador e intentarlo de nuevo."
            : e instanceof Error
              ? e.message
              : "No se pudo acceder a la cámara.",
        );
    }
  }
  async function analizar(intento: Intento) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setCargando(true);
    setError("");
    try {
      const resultado = await esperarCarga(analizarEnsayo(demo, intento, contexto, fallar));
      setAnterior(
        historial.find((e) => e.demo === demo) ??
          (demo ? ensayoAnteriorDemo() : undefined),
      );
      const ensayo: Ensayo = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        contexto: { ...contexto },
        resultado,
        demo,
        respuestas: {},
        solicitudes: [],
      };
      persistir(ensayo);
      setActual(ensayo);
      setVideo(intento.video);
      setPreparandoVideo(!!intento.video);
      setIntentoAnterior(intento);
      setIndiceJurado(0);
      setPaso("reporte");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos analizar el ensayo. Tu grabación sigue disponible.",
      );
    } finally {
      setFallar(false);
      setCargando(false);
      bloqueo.current = false;
    }
  }
  function actualizarRespuesta(i: number, r?: Repregunta) {
    setActual((prev) => {
      if (!prev) return prev;
      const e = {
        ...prev,
        solicitudes: [...new Set([...prev.solicitudes, i])],
        respuestas: r ? { ...prev.respuestas, [i]: r } : prev.respuestas,
      };
      return e;
    });
  }
  // Persistir respuestas fuera del actualizador: compatible con StrictMode.
  useEffect(() => {
    if (actual && paso === "jurado") persistir(actual);
  }, [actual]);
  function abrir(e: Ensayo) {
    setIntentoAnterior(null);
    setIndiceJurado(0);
    setArchivos([]);
    setActual(e);
    setContexto({ ...e.contexto });
    setDemo(e.demo);
    setAnterior(
      historial.find(
        (x) => x.id !== e.id && x.demo === e.demo && x.fecha < e.fecha,
      ),
    );
    setVideo(undefined);
    setError("");
    liberarStream(stream);
    setStream(null);
    setPaso("reporte");
  }
  return (
    <MotionConfig reducedMotion="user">
      <PantallaCarga activa={cargando} />
      <div className="app-shell" inert={cargando} aria-busy={cargando}>
        <Cabecera paso={paso} demo={demo} onInicio={inicio} />
        {aviso && <Mensaje>{aviso}</Mensaje>}
        {confirmarSalida && (
          <div className="exit-confirm" role="alert">
            <p>
              {confirmarSalida === "reporte"
                ? "¿Volver al reporte? Si estás grabando una respuesta, se descartará. Tu reporte y las respuestas ya enviadas se conservarán."
                : "¿Volver al inicio? La grabación en curso se descartará. Los resultados ya guardados se conservarán."}
            </p>
            <button
              className="button secondary"
              onClick={() => setConfirmarSalida(null)}
            >
              Seguir practicando
            </button>
            <button className="button danger" disabled={cargando || juradoEnviando} onClick={() => {
              if (confirmarSalida === "inicio") nuevo();
              else { setConfirmarSalida(null); setPaso("reporte"); }
            }}>
              {confirmarSalida === "reporte" ? "Confirmar regreso al reporte" : "Volver al inicio"}
            </button>
          </div>
        )}
        <main ref={main} tabIndex={-1} id="contenido">
          {paso !== "inicio" && (
            <nav className="back-navigation" aria-label="Volver al paso anterior">
              <button type="button" className="button secondary" onClick={volver}
                disabled={cargando || juradoEnviando}>
                <ArrowLeft size={18} aria-hidden="true" />
                {paso === "grabacion" ? "Volver a preparación"
                  : paso === "jurado" ? "Volver al reporte"
                    : intentoAnterior ? "Volver a la grabación" : "Volver a mis ensayos"}
              </button>
            </nav>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={paso}
              initial={{ opacity: 0, y: reduced ? 0 : 9 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.18 }}
            >
              {paso === "inicio" && (
                <Inicio
                  archivos={archivos}
                  onArchivos={setArchivos}
                  contexto={contexto}
                  onContexto={setContexto}
                  demo={demo}
                  onComenzar={() => {
                    setIntentoAnterior(null);
                    setError("");
                    setPaso("grabacion");
                  }}
                  onPermisos={permisos}
                  permisos={!!stream}
                  error={error}
                  historial={historial}
                  onAbrir={abrir}
                  onBorrar={() => {
                    try {
                      borrarEnsayos();
                      setArchivos([]);
                      setHistorial([]);
                      setAviso("");
                    } catch {
                      setAviso(
                        "No se pudieron borrar los datos del navegador. Inténtalo de nuevo.",
                      );
                    }
                  }}
                  stream={stream}
                  calibracionLista={!!baseVideo || omitirVideo}
                  onCalibrada={setBaseVideo}
                  onOmitirVideo={() => setOmitirVideo(true)}
                  audioListo={!!obtenerAdaptadorAudio()}
                />
              )}
              {paso === "grabacion" && (
                <Grabacion
                  baseVideo={baseVideo}
                  omitirVideo={omitirVideo}
                  intentoInicial={intentoAnterior}
                  demo={demo}
                  contexto={contexto}
                  stream={stream}
                  onStream={setStream}
                  onAnalizar={analizar}
                  cargando={cargando}
                  error={error}
                  onLimpiarError={() => setError("")}
                  fallar={fallar}
                  onFallar={setFallar}
                />
              )}
              {paso === "reporte" && actual && (
                <Reporte
                  onVideoPreparando={videoPreparando}
                  onVideoListo={videoListo}
                  onVideoError={videoFallido}
                  ensayo={actual}
                  anterior={anterior}
                  video={video}
                  onJurado={() => setPaso("jurado")}
                />
              )}
              {paso === "jurado" && actual && (
                <Jurado
                  indice={indiceJurado}
                  onIndice={setIndiceJurado}
                  onEnviando={setJuradoEnviando}
                  ensayo={actual}
                  onSolicitud={(i) => actualizarRespuesta(i)}
                  onRespuesta={actualizarRespuesta}
                  onNuevo={nuevo}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <Pie />
      </div>
    </MotionConfig>
  );
}
