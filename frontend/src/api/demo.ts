import type { Analisis, Contexto, Ensayo, Repregunta } from "../types";
export const contextoDemo: Contexto = {
  presentacion: "Sustentación de tesis ante 3 profesores",
  jurado: "exigente",
  rubrica: "",
};
export const analisisDemo: Analisis = {
  duracion: 180,
  rubrica_usada: "predeterminada",
  puntajes: { voz: 78, cuerpo: 64, contenido: 81, total: 74 },
  eventos: [
    {
      t: 35,
      tipo: "muletilla",
      origen: "transcripcion",
      detalle:
        "Tres muletillas seguidas al explicar el objetivo. Prueba una pausa breve antes de continuar.",
    },
    {
      t: 80,
      tipo: "mirada_baja",
      origen: "video",
      detalle:
        "Miraste hacia abajo durante 6 segundos al explicar la metodología. Levanta la mirada antes de presentar una decisión importante.",
    },
    {
      t: 130,
      tipo: "pausa_larga",
      origen: "audio",
      detalle:
        "Una pausa de 5 segundos interrumpió la explicación. Usa una frase de transición para conectar tus ideas.",
    },
    {
      t: 160,
      tipo: "manos_ocultas",
      origen: "video",
      detalle:
        "Las manos quedaron fuera del encuadre. Ajusta tu distancia a la cámara para acompañar el cierre con gestos.",
    },
  ],
  transcripcion:
    "Buenos días hoy presentaré cómo las herramientas digitales mejoran el aprendizaje universitario mediante una investigación cuantitativa con estudiantes de primer año"
      .split(" ")
      .map((palabra, i) => ({ palabra, inicio: i * 0.5, fin: i * 0.5 + 0.4 })),
  recomendaciones: [
    "Mira a la cámara al presentar tus ideas principales. Practica una frase completa antes de consultar tus notas.",
    "Sustituye las muletillas por pausas cortas. Una pausa intencional hace que tu mensaje sea más claro.",
    "Cierra con tu hallazgo principal y su impacto. Deja una idea concreta que el jurado pueda recordar.",
  ],
  preguntas_jurado: [
    "¿Por qué elegiste esta metodología y no un enfoque cualitativo?",
    "¿Qué limitación reconoces en tu muestra?",
    "¿Cómo validarías tus resultados?",
  ],
};
export const respuestasDemo: Repregunta[] = [
  {
    transcripcion_respuesta:
      "Elegí un enfoque cuantitativo para comparar los resultados entre grupos y medir el cambio en el aprendizaje.",
    repregunta:
      "¿Qué información importante podría quedar fuera al medir solamente resultados cuantitativos?",
  },
  {
    transcripcion_respuesta:
      "La muestra proviene de una sola universidad, por lo que los resultados podrían no representar a todos los estudiantes.",
    repregunta:
      "¿Cómo ampliarías la muestra para mejorar la representatividad del estudio?",
  },
  {
    transcripcion_respuesta:
      "Repetiría el estudio con otro grupo y compararía los resultados usando los mismos instrumentos de evaluación.",
    repregunta:
      "¿Qué harías si ese segundo grupo obtiene resultados diferentes?",
  },
];
export function ensayoAnteriorDemo(): Ensayo {
  return {
    id: "demo-anterior",
    fecha: "2026-11-06T15:00:00.000Z",
    contexto: contextoDemo,
    demo: true,
    resultado: {
      ...structuredClone(analisisDemo),
      puntajes: { voz: 70, cuerpo: 58, contenido: 76, total: 68 },
    },
    respuestas: {},
    solicitudes: [],
  };
}
