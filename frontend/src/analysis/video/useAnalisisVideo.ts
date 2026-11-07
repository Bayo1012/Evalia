import type { BaseVideo } from './calibracion';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ControladorVideo } from './controlador';
import { vistaInicial, type AnalisisVideo, type VistaVideo } from './interfaces';
import { VIDEO_CONFIG } from './config';

export function useAnalisisVideo(videoRef: RefObject<HTMLVideoElement | null>,
  opciones: { mock?: boolean; base?: BaseVideo | null } = {}): AnalisisVideo {
  const [vista, setVista] = useState<VistaVideo>(vistaInicial);
  const controlador = useRef<ControladorVideo | null>(null);
  const mock = opciones.mock ?? VIDEO_CONFIG.mock;
  const base = opciones.base ?? null;
  useEffect(() => {
    let montado = true;
    const instancia = new ControladorVideo(() => videoRef.current, v => { if (montado) setVista(v); }, mock, base);
    controlador.current = instancia;
    setVista(vistaInicial());
    return () => { montado = false; instancia.destruir(); if (controlador.current === instancia) controlador.current = null; };
  }, [videoRef, mock, base]);
  const iniciar = useCallback(async () => { await controlador.current?.iniciar(); }, []);
  const detener = useCallback(() => controlador.current?.detener() ?? [], []);
  const reiniciar = useCallback(async () => { await controlador.current?.reiniciar(); }, []);
  const sincronizarInicio = useCallback((inicioMs: number) => { controlador.current?.sincronizarInicio(inicioMs); }, []);
  const obtenerBase = useCallback(() => controlador.current?.obtenerBase() ?? null, []);
  return { ...vista, obtenerBase, iniciar, detener, reiniciar, sincronizarInicio };
}
