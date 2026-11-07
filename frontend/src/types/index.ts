export type Jurado = "exigente" | "curioso" | "formal" | "publico_general";
export interface Contexto {
  presentacion: string;
  jurado: Jurado;
  rubrica: string;
}
export interface Evento {
  t: number;
  tipo:
    | "mirada_baja"
    | "postura_inestable"
    | "manos_ocultas"
    | "volumen_bajo"
    | "volumen_alto"
    | "pausa_larga"
    | "ritmo_rapido"
    | "ritmo_lento"
    | "muletilla";
  origen: "video" | "audio" | "transcripcion";
  detalle: string;
}
export interface Analisis {
  duracion: number;
  rubrica_usada: "predeterminada" | "personalizada";
  puntajes: { voz: number; cuerpo: number; contenido: number; total: number };
  eventos: Evento[];
  transcripcion: { palabra: string; inicio: number; fin: number }[];
  recomendaciones: [string, string, string];
  preguntas_jurado: [string, string, string];
}
export interface Repregunta {
  transcripcion_respuesta: string;
  repregunta: string;
}
export interface Ensayo {
  id: string;
  fecha: string;
  contexto: Contexto;
  resultado: Analisis;
  demo: boolean;
  respuestas: Partial<Record<number, Repregunta>>;
  solicitudes: number[];
}
export interface Intento {
  audio?: Blob;
  video?: Blob;
  eventos: Evento[];
  duracion: number;
}
export type Paso = "inicio" | "grabacion" | "reporte" | "jurado";
