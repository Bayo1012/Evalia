import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import logoCarga from '../assets/eva-carga-transparente.png';
import './PantallaCarga.css';

/** Pantalla reutilizable para operaciones; no añade esperas a la navegación. */
export default function PantallaCarga({ activa, titulo = 'Estamos analizando tu ensayo…',
  detalle = 'Preparando tu reporte…', ayuda = 'Esto puede tomar unos momentos.' }: {
  activa: boolean; titulo?: string; detalle?: string; ayuda?: string;
}) {
  const estado = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activa) return;
    const focoAnterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    estado.current?.focus();
    return () => {
      document.body.style.overflow = overflowAnterior;
      if (focoAnterior instanceof HTMLElement && focoAnterior.isConnected) focoAnterior.focus();
    };
  }, [activa]);
  if (!activa) return null;
  return createPortal(
    <div className="loading-screen" ref={estado} role="status" aria-live="polite" aria-atomic="true" tabIndex={-1}>
      <div className="loading-screen-content">
        <div className="loading-emblem" aria-hidden="true">
          <svg className="loading-orbit" viewBox="0 0 240 240" focusable="false">
            {Array.from({ length: 24 }, (_, i) => {
              const angulo = i * Math.PI * 2 / 24;
              return <circle key={i} cx={120 + 108 * Math.cos(angulo)} cy={120 + 108 * Math.sin(angulo)}
                r={2.5 + i / 24 * 1.5} opacity={0.2 + i / 24 * 0.8} />;
            })}
          </svg>
          <img src={logoCarga} alt="" width={180} height={180} />
        </div>
        <span className="loading-eyebrow">EVALIA ESTÁ TRABAJANDO</span>
        <h1>{titulo}</h1>
        <p className="loading-detail">{detalle}</p>
        <p className="loading-help">{ayuda}</p>
      </div>
    </div>, document.body,
  );
}
