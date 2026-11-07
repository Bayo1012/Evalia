import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CameraOff,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { Ensayo, Evento } from "../types";
import { Acompanante, Barra, Boton, Tarjeta, tiempo } from "../components/ui";
const etiquetas: Record<Evento["tipo"], string> = {
  mirada_baja: "Mirada hacia abajo",
  postura_inestable: "Postura inestable",
  manos_ocultas: "Manos fuera de cuadro",
  volumen_bajo: "Volumen bajo",
  volumen_alto: "Volumen alto",
  pausa_larga: "Pausa larga",
  ritmo_rapido: "Ritmo rápido",
  ritmo_lento: "Ritmo lento",
  muletilla: "Muletillas seguidas",
};
export default function Reporte({
  ensayo,
  anterior,
  video,
  onJurado,
}: {
  ensayo: Ensayo;
  anterior?: Ensayo;
  video?: Blob;
  onJurado: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const [url, setUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const r = ensayo.resultado;
  const evento = r.eventos[indice];
  useEffect(() => {
    if (!video) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(video);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [video]);
  function seleccionar(i: number) {
    setIndice(i);
    if (videoRef.current) videoRef.current.currentTime = r.eventos[i].t;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <Check size={14} /> ENSAYO COMPLETADO
          </span>
          <h1>Así suena tu potencial.</h1>
          <p>
            Encontramos {r.eventos.length} momentos para mejorar en{" "}
            {tiempo(r.duracion)} de presentación.
          </p>
        </div>
        <span className="pill">
          <Sparkles size={16} /> Rúbrica {r.rubrica_usada}
        </span>
      </div>
      <div className="scores-grid">
        {(["voz", "cuerpo", "contenido", "total"] as const).map((key, i) => (
          <Tarjeta
            key={key}
            className={`score-card ${key === "total" ? "total-score" : ""}`}
          >
            <div className="score-top">
              <h2>{["Voz", "Cuerpo", "Contenido", "Total"][i]}</h2>
              <span>
                {r.puntajes[key] >= 75 ? "Buen avance" : "Sigue practicando"}
              </span>
            </div>
            <div className="score-value">
              {r.puntajes[key]}
              <small>/100</small>
            </div>
            <Barra valor={r.puntajes[key]} />
            {anterior && (
              <p className="comparison">
                <ArrowUpRight size={14} />
                {r.puntajes[key] - anterior.resultado.puntajes[key] >= 0
                  ? "+"
                  : ""}
                {r.puntajes[key] - anterior.resultado.puntajes[key]} puntos vs.
                ensayo anterior
              </p>
            )}
          </Tarjeta>
        ))}
      </div>
      {anterior && (
        <p className="comparison-note">
          Comparación con {anterior.demo ? "un ensayo simulado" : "tu ensayo"}{" "}
          del {new Date(anterior.fecha).toLocaleDateString("es-PE")}
          {anterior.contexto.rubrica !== ensayo.contexto.rubrica
            ? " · Las rúbricas son diferentes."
            : ""}
          .
        </p>
      )}
      <Tarjeta className="moments-card">
        <div className="section-heading">
          <h2>
            <AudioLines size={20} /> Los momentos que importan
          </h2>
          <span className="tiny">Selecciona un momento para descubrir más</span>
        </div>
        <div className="moment-grid">
          <div className="replay-stage">
            {url ? (
              <video ref={videoRef} src={url} controls playsInline />
            ) : (
              <div className="no-video">
                <span className="replay-icon">
                  <CameraOff size={28} />
                </span>
                <h3>
                  {ensayo.demo
                    ? "Tu demo, sin grabaciones"
                    : "Video local no disponible"}
                </h3>
                <p>
                  {ensayo.demo
                    ? "Estos eventos son ejemplos simulados. No se ha grabado ni almacenado video."
                    : "El historial conserva el reporte, pero no guarda archivos de audio o video."}
                </p>
                <span className="pill">
                  {tiempo(evento?.t ?? 0)} / {tiempo(r.duracion)}
                </span>
              </div>
            )}
          </div>
          <div className="moment-detail" aria-live="polite">
            <span className="moment-time">{tiempo(evento?.t ?? 0)}</span>
            <div className="divider" />
            <span className="eyebrow">
              {evento
                ? `SEÑAL DE ${evento.origen === "video" ? "CUERPO" : evento.origen === "audio" ? "VOZ" : "TRANSCRIPCIÓN"}`
                : "TU ENSAYO"}
            </span>
            <h3>
              {evento ? etiquetas[evento.tipo] : "Sin eventos detectados"}
            </h3>
            <p>
              {evento?.detalle ??
                "No se registraron momentos específicos en este ensayo."}
            </p>
            <div className="decor-wave" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => (
                <span key={i} style={{ height: 12 + ((i * 13) % 38) }} />
              ))}
            </div>
          </div>
        </div>
        <div className="timeline-track" aria-hidden="true">
          {r.eventos.map((e, i) => (
            <span
              key={i}
              className={indice === i ? "active" : ""}
              style={{
                left: `${Math.max(1, Math.min(99, (e.t / Math.max(1, r.duracion)) * 100))}%`,
              }}
            />
          ))}
        </div>
        <div className="timeline-events">
          {r.eventos.map((e, i) => (
            <button
              key={i}
              aria-pressed={indice === i}
              onClick={() => seleccionar(i)}
            >
              <span>{tiempo(e.t)}</span>
              <strong>{etiquetas[e.tipo]}</strong>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </Tarjeta>
      <div className="recommendations-heading">
        <div>
          <span className="eyebrow">PEQUEÑOS AJUSTES, GRANDES CAMBIOS</span>
          <h2>Para tu próximo ensayo</h2>
        </div>
        <Acompanante>Tu siguiente versión ya está más cerca.</Acompanante>
      </div>
      <div className="recommendations">
        {r.recomendaciones.map((texto, i) => (
          <Tarjeta key={i}>
            <span className="recommendation-number">0{i + 1}</span>
            <h3>
              {
                [
                  "Conecta con tu audiencia",
                  "Dale espacio a tus ideas",
                  "Deja una idea memorable",
                ][i]
              }
            </h3>
            <p>{texto}</p>
          </Tarjeta>
        ))}
      </div>
      <details className="transcript">
        <summary>Ver transcripción {ensayo.demo ? "de ejemplo" : ""}</summary>
        <p>
          {r.transcripcion.map((w) => w.palabra).join(" ") ||
            "No hay transcripción disponible."}
        </p>
      </details>
      <div className="report-next">
        <p>
          Ya conoces tu presentación.
          <br />
          <strong>Ahora, prepárate para defenderla.</strong>
        </p>
        <Boton onClick={onJurado}>
          Ver preguntas del jurado <ArrowRight size={18} />
        </Boton>
      </div>
    </>
  );
}
