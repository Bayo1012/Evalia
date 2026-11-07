import {
  ArrowRight,
  Camera,
  Check,
  ClipboardList,
  History,
  LockKeyhole,
  Sparkles,
  Target,
  Trash2,
  Users,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import type { Contexto, Ensayo, Jurado } from "../types";
import { Boton, Mensaje, RobotEvalia, Tarjeta } from "../components/ui";
const jurados: {
  id: Jurado;
  nombre: string;
  descripcion: string;
  icono: typeof Target;
}[] = [
  {
    id: "exigente",
    nombre: "Exigente",
    descripcion: "Pon a prueba tus argumentos",
    icono: Target,
  },
  {
    id: "curioso",
    nombre: "Curioso",
    descripcion: "Explora nuevas perspectivas",
    icono: Sparkles,
  },
  {
    id: "formal",
    nombre: "Evaluador formal",
    descripcion: "Afina estructura y claridad",
    icono: ClipboardList,
  },
  {
    id: "publico_general",
    nombre: "Público general",
    descripcion: "Haz que todos te entiendan",
    icono: Users,
  },
];
export const nombresJurado = Object.fromEntries(
  jurados.map((j) => [j.id, j.nombre]),
) as Record<Jurado, string>;
interface Props {
  contexto: Contexto;
  onContexto: (c: Contexto) => void;
  demo: boolean;
  onDemo: (v: boolean) => void;
  onComenzar: () => void;
  onPermisos: () => Promise<void>;
  permisos: boolean;
  error: string;
  historial: Ensayo[];
  onAbrir: (e: Ensayo) => void;
  onBorrar: () => void;
  onEjemplo: () => void;
  audioListo: boolean;
}
export default function Inicio(p: Props) {
  const [pidiendo, setPidiendo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  return (
    <>
      <div className="intro-grid">
        <section className="hero">
          <div className="eyebrow hero-label">
            <span /> TU PRÓXIMA VERSIÓN EMPIEZA AQUÍ
          </div>
          <h1>
            Presenta con
            <br />
            <span>seguridad.</span>
          </h1>
          <p className="hero-description">
            Practica tu presentación. Descubre tu potencial.
            <br className="desktop" /> Llega con seguridad al momento que
            importa.
          </p>
          <div className="hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="art-cross cross-one">+</span>
            <span className="art-cross cross-two">+</span>
            <div className="art-paper">
              <RobotEvalia grande estado="flotando" />
            </div>
            <div className="art-caption">
              <Sparkles size={15} /> TU COMPAÑERA DE ENSAYO
            </div>
            <span className="art-code">EV—01 / READY</span>
            <div className="hero-sticker">
              <span className="status-dot" /> Una práctica más.
              <br />
              <strong>Un paso más lejos.</strong>
            </div>
          </div>
          <div className="hero-bottom">
            <span>
              Presenta con <em>seguridad.</em>
            </span>
            <span className="tiny">
              <LockKeyhole size={13} /> Tu video se queda contigo
            </span>
          </div>
        </section>
        <Tarjeta className="setup-card">
          <div className="setup-heading">
            <div>
              <span className="eyebrow">PREPARA TU ENSAYO</span>
              <h2>Hagamos que se entienda.</h2>
            </div>
            <span className="number-chip">01</span>
          </div>
          <div className="mode-switch" aria-label="Modo de ensayo">
            <button aria-pressed={p.demo} onClick={() => p.onDemo(true)}>
              <WandSparkles size={15} /> Demostración
            </button>
            <button aria-pressed={!p.demo} onClick={() => p.onDemo(false)}>
              <Camera size={15} /> Ensayo real
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              p.onComenzar();
            }}
          >
            <label className="field-label" htmlFor="presentacion">
              ¿Qué vas a presentar y ante quién?
            </label>
            <textarea
              id="presentacion"
              rows={2}
              maxLength={1200}
              required
              value={p.contexto.presentacion}
              onChange={(e) =>
                p.onContexto({ ...p.contexto, presentacion: e.target.value })
              }
              placeholder="Ej. Mi tesis ante tres profesores"
            />
            <p className="field-help">
              Un poco de contexto hace mejores preguntas.
            </p>
            <fieldset className="jury-field">
              <legend>Elige a tu jurado</legend>
              <div className="jury-options">
                {jurados.map((j) => (
                  <label
                    key={j.id}
                    className={`jury-option ${p.contexto.jurado === j.id ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="jurado"
                      value={j.id}
                      checked={p.contexto.jurado === j.id}
                      onChange={() =>
                        p.onContexto({ ...p.contexto, jurado: j.id })
                      }
                    />
                    <span className="option-icon">
                      <j.icono size={20} />
                    </span>
                    <span>
                      <strong>{j.nombre}</strong>
                      <small>{j.descripcion}</small>
                    </span>
                    <span className="radio-indicator">
                      {p.contexto.jurado === j.id && <span />}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <details className="rubric">
              <summary>
                <ClipboardList size={17} />
                <span>
                  Rúbrica de evaluación <small>Opcional</small>
                </span>
                <span>+</span>
              </summary>
              <p>
                Usamos una rúbrica predeterminada de voz, cuerpo y contenido. Si
                tienes otra, pégala aquí.
              </p>
              <label className="sr-only" htmlFor="rubrica">
                Rúbrica personalizada
              </label>
              <textarea
                id="rubrica"
                rows={3}
                maxLength={12000}
                value={p.contexto.rubrica}
                onChange={(e) =>
                  p.onContexto({ ...p.contexto, rubrica: e.target.value })
                }
                placeholder="Pega la rúbrica de tu profesor…"
              />
            </details>
            <p className="rubric-note">
              {p.contexto.rubrica.trim()
                ? "Rúbrica personalizada seleccionada"
                : "Rúbrica predeterminada: voz, cuerpo y contenido"}
            </p>
            <div className="privacy">
              <LockKeyhole size={17} />
              <p>
                Tu video se analiza en tu navegador. El audio solo se envía al
                backend cuando confirmas el análisis.
                {p.demo && " En demo no grabamos ni enviamos nada."}
              </p>
            </div>
            {!p.demo && (
              <>
                <Boton
                  type="button"
                  variante="secondary"
                  className="full"
                  disabled={pidiendo}
                  onClick={async () => {
                    setPidiendo(true);
                    try {
                      await p.onPermisos();
                    } finally {
                      setPidiendo(false);
                    }
                  }}
                >
                  {p.permisos ? <Check size={17} /> : <Camera size={17} />}{" "}
                  {pidiendo
                    ? "Esperando permisos…"
                    : p.permisos
                      ? "Cámara y micrófono disponibles"
                      : "Activar cámara y micrófono"}
                </Boton>
                {!p.audioListo && (
                  <Mensaje>
                    La grabación real estará disponible al conectar el módulo de
                    audio. Puedes recorrer todo en demostración.
                  </Mensaje>
                )}
              </>
            )}
            {p.error && <Mensaje error>{p.error}</Mensaje>}
            <Boton
              className="full start-button"
              type="submit"
              disabled={
                !p.contexto.presentacion.trim() ||
                (!p.demo && (!p.permisos || !p.audioListo))
              }
            >
              Comenzar ensayo <ArrowRight size={19} />
            </Boton>
            <p className="form-footnote">
              {p.demo
                ? "Sin cámara ni micrófono · Recorrido con datos de ejemplo"
                : "Hasta 10 minutos · Sin crear una cuenta"}
            </p>
          </form>
        </Tarjeta>
      </div>
      <section className="history-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CADA ENSAYO CUENTA</span>
            <h2>
              <History size={21} /> Mis ensayos{" "}
              <span className="count">{p.historial.length}</span>
            </h2>
          </div>
          <div className="actions">
            <Boton
              variante="ghost"
              onClick={p.onEjemplo}
              disabled={p.historial.some((e) => e.id === "demo-anterior")}
            >
              Cargar ensayo de ejemplo
            </Boton>
            {p.historial.length > 0 && (
              <Boton variante="ghost" onClick={() => setConfirmar(true)}>
                <Trash2 size={15} /> Borrar mis datos
              </Boton>
            )}
          </div>
        </div>
        {confirmar && (
          <div className="delete-confirm" role="alert">
            <p>
              Se borrarán los ensayos y las respuestas guardadas en este
              navegador.
            </p>
            <Boton
              variante="danger"
              onClick={() => {
                p.onBorrar();
                setConfirmar(false);
              }}
            >
              Confirmar borrado
            </Boton>
            <Boton variante="secondary" onClick={() => setConfirmar(false)}>
              Cancelar
            </Boton>
          </div>
        )}
        {p.historial.length ? (
          <div className="history-grid">
            {p.historial.map((e) => (
              <button
                className="history-item"
                key={e.id}
                onClick={() => p.onAbrir(e)}
              >
                <span className="history-score">
                  {e.resultado.puntajes.total}
                  <small>/100</small>
                </span>
                <span>
                  <strong>{e.contexto.presentacion}</strong>
                  <small>
                    {new Date(e.fecha).toLocaleDateString("es-PE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {e.demo ? "Datos simulados" : "Ensayo real"}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <div className="history-empty">
            <History size={22} />
            <p>
              Tu progreso empieza con un primer ensayo.
              <small>Los resultados se guardarán solo en este navegador.</small>
            </p>
          </div>
        )}
      </section>
    </>
  );
}
