import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Mic,
  Sparkles,
  Square,
} from "lucide-react";
import type { Ensayo, Repregunta } from "../types";
import {
  Boton,
  Cargando,
  Mensaje,
  RobotEvalia,
  Tarjeta,
} from "../components/ui";
import { responderJurado } from "../api/services";
import {
  liberarStream,
  obtenerAdaptadorAudio,
  type SesionAudio,
} from "../integrations/audio";
export default function Jurado({
  ensayo,
  onSolicitud,
  onRespuesta,
  onNuevo,
  indice,
  onIndice,
  onEnviando,
}: {
  ensayo: Ensayo;
  onSolicitud: (i: number) => void;
  onRespuesta: (i: number, r: Repregunta) => void;
  onNuevo: () => void;
  indice: number;
  onIndice: (indice: number) => void;
  onEnviando: (enviando: boolean) => void;
}) {
  const [estado, setEstado] = useState<
    "listo" | "preparando" | "grabando" | "cargando"
  >("listo");
  const [error, setError] = useState("");
  const [fin, setFin] = useState(false);
  const bloqueo = useRef(false);
  const hechas = useRef(new Set(ensayo.solicitudes));
  const sesion = useRef<SesionAudio | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    onEnviando(estado === "cargando");
    return () => onEnviando(false);
  }, [estado, onEnviando]);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      try { sesion.current?.cancelar(); } catch { /* liberar también el micrófono */ }
      liberarStream(stream.current);
    };
  }, []);
  const respuesta = ensayo.respuestas[indice];
  const solicitada = ensayo.solicitudes.includes(indice);
  async function grabar() {
    if (bloqueo.current || solicitada || respuesta) return;
    bloqueo.current = true;
    setError("");
    setEstado("preparando");
    try {
      if (!ensayo.demo) {
        const adaptador = obtenerAdaptadorAudio();
        if (!adaptador)
          throw new Error("Conecta el módulo de audio para responder con voz.");
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!vivo.current) {
          liberarStream(s);
          return;
        }
        stream.current = s;
        const nueva = await adaptador.iniciar(s, () => {});
        if (!vivo.current) {
          nueva.cancelar();
          liberarStream(s);
          return;
        }
        sesion.current = nueva;
      }
      setEstado("grabando");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos acceder al micrófono.",
      );
      setEstado("listo");
      liberarStream(stream.current);
    } finally {
      bloqueo.current = false;
    }
  }
  async function enviar() {
    if (bloqueo.current || hechas.current.has(indice)) return;
    bloqueo.current = true;
    setEstado("cargando");
    let enviada = false;
    try {
      const grabacion = await sesion.current?.detener();
      sesion.current = null;
      liberarStream(stream.current);
      if (!ensayo.demo && !grabacion?.audio.size)
        throw new Error(
          "No se obtuvo audio. Puedes grabar la respuesta de nuevo.",
        );
      hechas.current.add(indice);
      onSolicitud(indice);
      enviada = true;
      const r = await responderJurado(
        ensayo.demo,
        indice,
        grabacion?.audio,
        ensayo.resultado.preguntas_jurado[indice],
        ensayo.contexto,
      );
      if (vivo.current) onRespuesta(indice, r);
    } catch (e) {
      if (vivo.current)
        setError(
          `${e instanceof Error ? e.message : "No se pudo generar la repregunta."}${enviada ? " Para respetar el límite de una solicitud, puedes continuar con la siguiente pregunta." : ""}`,
        );
    } finally {
      liberarStream(stream.current);
      bloqueo.current = false;
      if (vivo.current) setEstado("listo");
    }
  }
  function siguiente() {
    setError("");
    if (indice === 2) setFin(true);
    else onIndice(indice + 1);
  }
  if (fin)
    return (
      <Tarjeta className="finish">
        <div className="finish-art">
          <RobotEvalia />
        </div>
        <span className="eyebrow">UN ENSAYO MÁS. MÁS CONFIANZA.</span>
        <h1>Tu voz ya llegó más lejos.</h1>
        <p>
          Completaste las tres preguntas. No se trata de memorizar una respuesta
          perfecta, sino de aprender a defender tus ideas.
        </p>
        <div className="finish-checks">
          <span>
            <Check size={16} /> Presentación analizada
          </span>
          <span>
            <Check size={16} /> Jurado completado
          </span>
        </div>
        <Boton onClick={onNuevo}>
          Nuevo ensayo <ArrowRight size={18} />
        </Boton>
      </Tarjeta>
    );
  return (
    <div className="jury-page">
      <section className="jury-intro">
        <span className="eyebrow">SIMULACIÓN DE DEFENSA</span>
        <h1>
          El jurado
          <br />
          <em>te pregunta.</em>
        </h1>
        <div className="jury-art">
          <RobotEvalia />
          <span>
            <Sparkles size={16} /> Evalia está contigo
          </span>
        </div>
        <p>
          Una pregunta a la vez. Respira, ordena tus ideas y responde con tu
          propia voz.
        </p>
        <div
          className="jury-progress"
          aria-label={`Pregunta ${indice + 1} de 3`}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} className={i <= indice ? "active" : ""} />
          ))}
        </div>
        <span className="tiny">PREGUNTA {indice + 1} DE 3</span>
      </section>
      <section className="jury-work">
        <Tarjeta className="question-card">
          <div className="question-top">
            <span className="eyebrow">TU TURNO DE ARGUMENTAR</span>
            <span className="question-number">
              0{indice + 1}
              <small>/ 03</small>
            </span>
          </div>
          <h2>{ensayo.resultado.preguntas_jurado[indice]}</h2>
          <p>El jurado busca entender el criterio detrás de tu decisión.</p>
          {ensayo.demo && (
            <div className="demo-response-note">
              <Sparkles size={16} />
              Respuesta y transcripción simuladas. No se usa el micrófono.
            </div>
          )}
          {!respuesta && !solicitada && estado === "listo" && (
            <Boton variante="secondary" onClick={() => void grabar()}>
              <Mic size={18} />
              Responder con voz
            </Boton>
          )}
          {estado === "preparando" && (
            <Cargando>Preparando micrófono…</Cargando>
          )}
          {estado === "grabando" && (
            <div className="answer-recording" role="status">
              <span className="recording-label">
                <span className="recording-dot" />
                {ensayo.demo
                  ? "Grabación simulada de tu respuesta"
                  : "Grabando tu respuesta…"}
              </span>
              <Boton variante="danger" onClick={() => void enviar()}>
                <Square size={15} />
                Detener y enviar respuesta
              </Boton>
              <small>
                {ensayo.demo
                  ? "Se mostrará una respuesta de ejemplo."
                  : "Al detener se enviará el audio de esta respuesta al backend."}
              </small>
            </div>
          )}
          {estado === "cargando" && (
            <Cargando>El jurado está leyendo tu respuesta…</Cargando>
          )}
          {error && <Mensaje error>{error}</Mensaje>}
          {solicitada && !respuesta && estado === "listo" && !error && (
            <Mensaje>
              Ya se utilizó la solicitud de esta pregunta. Puedes continuar.
            </Mensaje>
          )}
          {respuesta && (
            <div className="answer-result">
              <span className="eyebrow">
                TU RESPUESTA {ensayo.demo ? "· SIMULADA" : ""}
              </span>
              <blockquote>{respuesta.transcripcion_respuesta}</blockquote>
              <div className="followup">
                <span className="eyebrow">
                  <Sparkles size={13} /> UNA IDEA PARA PROFUNDIZAR
                </span>
                <h3>{respuesta.repregunta}</h3>
                <p>
                  Respóndela en voz alta para practicar. No se grabará ni se
                  enviará otra respuesta.
                </p>
              </div>
            </div>
          )}
        </Tarjeta>
        <div className="jury-bottom">
          <span className="tiny">
            <LockKeyhole size={15} /> Se guarda el texto; nunca el audio.
          </span>
          {(respuesta || solicitada) && estado === "listo" && (
            <Boton onClick={siguiente}>
              {indice === 2 ? "Finalizar práctica" : "Siguiente pregunta"}
              <ArrowRight size={18} />
            </Boton>
          )}
        </div>
      </section>
    </div>
  );
}
