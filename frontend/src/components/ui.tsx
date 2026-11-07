import { motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Paso } from "../types";
import robotGrande from "../assets/eva-perfil-transparente.png";
import robotPequeno from "../assets/eva-cabeza-transparente.png";
export function Boton({
  children,
  variante = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button ${variante} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Tarjeta({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Mensaje({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`message ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  );
}
export function Cargando({
  children = "Preparando tu reporte…",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={25} />
      <span>{children}</span>
    </div>
  );
}
export function IdentidadEvalia() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <img src={robotPequeno} alt="" />
      </span>
      <span>
        evalia<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function RobotEvalia({
  grande = false,
  estado = "quieto",
}: {
  grande?: boolean;
  estado?: "flotando" | "quieto";
}) {
  return (
    <img
      src={grande ? robotGrande : robotPequeno}
      alt={grande ? "Robot violeta de Evalia" : ""}
      className={`robot ${grande ? "large" : "small"} ${estado === "flotando" ? "floating" : ""}`}
    />
  );
}
const pasos: Paso[] = ["inicio", "grabacion", "reporte", "jurado"];
export function Cabecera({
  paso,
  demo,
  onInicio,
}: {
  paso: Paso;
  demo: boolean;
  onInicio: () => void;
}) {
  const activo = pasos.indexOf(paso);
  return (
    <header className="header">
      <button
        className="brand-button"
        onClick={onInicio}
        aria-label="Volver al inicio"
      >
        <IdentidadEvalia />
      </button>
      <nav aria-label="Progreso del ensayo">
        <ol className="steps">
          {["Prepara", "Ensaya", "Descubre", "Defiende"].map((nombre, i) => (
            <li
              key={nombre}
              className={i === activo ? "active" : i < activo ? "complete" : ""}
              aria-current={i === activo ? "step" : undefined}
            >
              <span className="step-number">
                {i < activo ? <Check size={12} /> : `0${i + 1}`}
              </span>
              <span>{nombre}</span>
            </li>
          ))}
        </ol>
      </nav>
      <span className={`mode-badge ${demo ? "" : "real"}`}>
        <span />
        {demo ? "Modo demo: datos simulados" : "Modo real"}
      </span>
    </header>
  );
}
export function Barra({ valor }: { valor: number }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="bar"
      role="meter"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Puntaje"
    >
      <motion.div
        initial={{ width: reduced ? `${valor}%` : 0 }}
        animate={{ width: `${valor}%` }}
        transition={{ duration: reduced ? 0 : 0.8 }}
      />
    </div>
  );
}
export function Acompanante({ children }: { children: ReactNode }) {
  return (
    <div className="companion">
      <span className="avatar">
        <RobotEvalia />
      </span>
      <div>
        <span className="eyebrow">EVALIA TE ACOMPAÑA</span>
        <strong>{children}</strong>
      </div>
      <Sparkles size={18} />
    </div>
  );
}
export function Pie() {
  return (
    <footer className="footer">
      <span>
        Hecho para tu próxima gran idea <ArrowUpRight size={14} />
      </span>
    </footer>
  );
}
export const tiempo = (segundos: number) =>
  `${Math.floor(segundos / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(segundos % 60)
    .toString()
    .padStart(2, "0")}`;
