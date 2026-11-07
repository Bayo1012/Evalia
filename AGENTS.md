## Evalia: informe técnico (contexto para IA)

N ov 7, 2026 · @Diego

## Resumen y contexto del reto

Evalia es una app web sin cuenta donde un estudiante ensaya una exposición oral y recibe un reporte de voz, cuerpo y contenido, más tres preguntas del jurado en texto con una repregunta por pregunta.

- Reto: Hackathon Eneisoft XVI (FISI-UNMSM), sub-eje Académico (evaluación y retroalimentación automatizada). Se construye desde cero el sábado 7 de noviembre, en 8 horas; no se permite llevar código avanzado.

- Rúbrica oficial del evento (100 puntos): funcionamiento del prototipo 30, problema e impacto 25, innovación y creatividad 20, calidad técnica y arquitectura 15, pitch 10.

- Lo que pide el código: un flujo principal estable y demostrable sin fallas (30 puntos) y un repositorio con estructura clara, arquitectura modular, buenas prácticas y uso eficiente de APIs (15 puntos).

- Prioridad técnica: un flujo completo y estable de punta a punta antes que más funciones.

- Equipo: Diego (frontend e instrucciones de la IA), Erick (audio y backend), Carlo (video).

## Alcance

El MVP cubre un solo flujo completo: configurar, grabar, ver el reporte y responder tres preguntas del jurado.

## Entra

- Inicio con aviso de rúbrica predeterminada y cuadro para pegar una rúbrica propia.

- Grabación de cámara y micrófono en el navegador.

- Métricas de voz y de cuerpo en el navegador; transcripción y muletillas en el backend.

- Reporte con puntajes, línea de tiempo y recomendaciones.

- Tres preguntas del jurado al final de la exposición, solo en texto, y una repregunta por pregunta, también en texto.

- Historial de ensayos guardado en el navegador, con comparación contra el anterior.

## Queda fuera

- Cuentas o login, y más de 4 pantallas.

- Voz sintética del jurado.


- Más de una repregunta por pregunta.

- Guardar video o audio en un servidor.

- Aplicación móvil nativa.

## Arquitectura y stack

El navegador hace el análisis pesado y el backend solo transcribe y llama al modelo de lenguaje; el video nunca sale del navegador.

| Capa | Tecnología | Función |
| --- | --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind | 4 pantallas; el paso actual se |
|   | v4, pnpm | guarda en una variable de |
|   |   | estado, sin router |
| Video | MediaPipe Tasks Vision (Face | Mirada, postura y gestos, |
|   | Landmarker, Pose Landmarker) en | convertidos en eventos |
|   | el navegador |   |
| Audio en el | Web Audio API y MediaRecorder | Volumen, pausas, ritmo y |
| navegador |   | grabación del audio |
| Backend | FastAPI (Python) | Transcribe, detecta muletillas y |
|   |   | llama al modelo |
| Transcripción | Por decidir entre faster-whisper , | Texto con tiempos por palabra |
|   | Gemini con audio y la API de |   |
|   | OpenAI |   |
| Modelo de | Gemini u otro proveedor, detrás de | Evaluador, jurado, reporte y |
| lenguaje | services/llm.py | repregunta, siempre con salida |
|   |   | JSON |
| Almacenamiento | Almacenamiento local del | Historial; no hay base de datos |
|   | navegador |   |

## Reglas de diseño

- El video se analiza en el navegador y no se envía; al backend solo viajan audio y eventos.

- El modelo de lenguaje se llama solo desde el backend, y solo desde services/llm.py , para poder cambiar de proveedor.

- Las claves viven en backend/.env , nunca en git ni en el frontend. backend/.env.example es la plantilla.


- El backend no guarda estado entre llamadas.

## Flujo y pantallas

Hay 4 pantallas fijas, sin login ni menús. App.tsx guarda una variable paso con uno de estos valores y muestra la pantalla que corresponde: inicio , grabacion , reporte ,

jurado .

- 1. Inicio ( pages/Inicio.tsx ):

- Campo "¿Qué vas a presentar y ante quién?".

- Aviso de rúbrica: texto visible que dice que Evalia usa una rúbrica predeterminada (voz, cuerpo y contenido) y que, si el profesor dio una rúbrica u otra, se puede pegar en un cuadro de texto opcional.

- Elección de jurado: exigente, curioso, formal o público general.

- Nota de privacidad ("tu video se analiza en tu navegador"), botón para dar permisos de cámara y micrófono, botón "Comenzar ensayo" y lista "Mis ensayos".

- 2. Grabación ( pages/Grabacion.tsx ): cámara con puntos de seguimiento, indicadores en vivo (volumen, ritmo, contacto visual, postura), cronómetro, límite de duración y botón "Detener". Al detener se envía el audio y los eventos a /api/analizar , con una animación de carga que no cuenta como pantalla.

- 3. Reporte ( pages/Reporte.tsx ): puntajes de Voz, Cuerpo, Contenido y Total, línea de tiempo con momentos clave, recomendaciones, indicador de qué rúbrica se usó ( rubrica_usada ), comparación con el ensayo anterior y botón "Ver preguntas del jurado".

- 4. Jurado ( pages/Jurado.tsx ), todo en texto:

- Se muestra la pregunta 1 de 3.

- El estudiante responde hablando; se graba solo esa respuesta y se envía a /api/repregunta .

- Aparece una sola repregunta en texto para esa pregunta.

- Botón "Siguiente pregunta". Tras la tercera, se muestra un cierre y el botón "Nuevo ensayo".

El límite de una repregunta por pregunta lo impone el frontend: después de mostrar la repregunta no se vuelve a llamar al backend para esa pregunta.

## Rúbrica

Evalia siempre evalúa contra una rúbrica: la predeterminada, o la que el usuario pegue en la pantalla de Inicio.


- Si contexto.rubrica llega vacío, el backend usa backend/app/prompts/rubrica_predeterminada.md y responde rubrica_usada: "predeterminada" .

- Si trae texto, esa rúbrica reemplaza a la predeterminada en el evaluador de contenido, en el jurado y en el redactor del reporte, y se responde rubrica_usada: "personalizada" .

- Las métricas de voz y de cuerpo se miden igual en ambos casos; la rúbrica cambia cómo se evalúa el contenido, qué recomendaciones se dan y qué preguntas se hacen.

- El frontend muestra siempre cuál se usó en el Reporte.

Contenido de partida de la rúbrica predeterminada (se puede ajustar):

- \# Rúbrica predeterminada de Evalia

\## Voz (claridad y ritmo)

- \- Volumen audible y estable durante toda la exposición.

- \- Ritmo adecuado: ni apresurado ni demasiado lento.

- \- Pocas muletillas y pausas que ayudan a la comprensión.

\## Cuerpo (presencia)

- \- Mantiene contacto visual con la cámara.

- \- Postura estable, sin balanceo excesivo.

- \- Manos visibles y gestos naturales.

\## Contenido (estructura y coherencia)

- \- Presenta el objetivo al inicio.

- \- Sigue una secuencia lógica de ideas.

- \- Sustenta sus afirmaciones con argumentos o datos.

- \- Cierra con una conclusión clara y respeta el tiempo.

## Análisis de voz, cuerpo y muletillas

Cada hallazgo se convierte en un evento con tiempo, tipo, origen y detalle; la línea de tiempo del Reporte sale de esos eventos.

| Dimensión Qué se mide |   | Dónde corre | Herramienta | Dueño |
| --- | --- | --- | --- | --- |
| Voz | Volumen, | Navegador | Web Audio API; | Erick |
|   | pausas largas, | (volumen, | transcripción con |   |
|   | ritmo en | pausas) y | tiempos por |   |
|   | palabras por | backend (ritmo, | palabra |   |
|   | minuto | con la |   |   |
|   |   | transcripción) |   |   |


| Dimensión Qué se mide | Dónde corre | Herramienta | Dueño |
| --- | --- | --- | --- |
| Muletillas Palabras ("o | Backend | Conteo sobre la | Erick |
| sea", "este", |   | transcripción; |   |
| "bueno", "ya |   | instrucción inicial |   |
| pues", "como |   | en español para |   |
| que", "tipo", |   | recuperar |   |
| "¿no?") y |   | sonidos; pausas |   |
| sonidos |   | largas como |   |
| ("eeeh", |   | refuerzo |   |
| "mmm") |   |   |   |
| Cuerpo Contacto | Navegador | MediaPipe (Face | Carlo |
| visual, postura, |   | Landmarker y |   |
| balanceo, |   | Pose |   |
| manos ocultas |   | Landmarker) |   |
| Contenido Estructura, | Backend | Modelo de | Erick (llamada), |
| coherencia, |   | lenguaje con | Diego |
| vacíos, según la |   | salida JSON | (instrucciones) |
| rúbrica |   |   |   |

Muletillas, enfoque híbrido. Los modelos de transcripción tienden a borrar los sonidos de relleno, así que las muletillas que son palabras se cuentan en la transcripción y los sonidos se atacan con una instrucción inicial en español más la medición de pausas. Un estudio con exposiciones en español encontró que Whisper detecta bastantes muletillas pero falla con las compuestas, así que sirve como diagnóstico y no como conteo exacto (estudio). [URL 🔗](https://www.scitepress.org/Papers/2024/126221/126221.pdf)

Motor de transcripción por decidir. Probar faster-whisper local, Gemini con audio y la API de OpenAI con 3 o 4 grabaciones propias con muletillas contadas a mano, y elegir el que detecte más con menos falsos positivos. Si el tiempo aprieta, usar el que ya funcione.

Puntajes (valores de partida, se calibran). Cada categoría va de 0 a 100, parte de 100 y descuenta por evento según su gravedad; el total es el promedio de las tres. Umbrales iniciales: mirada baja si la mirada sale de la cámara más de 5 segundos; pausa larga si el silencio supera 3 segundos. Calibración de 3 segundos mirando a la cámara al empezar. Procesar unos 5 cuadros de video por segundo, no todos.

## Jurado: preguntas y repreguntas

Al final de la exposición el jurado hace exactamente 3 preguntas en texto, y cada una admite exactamente 1 repregunta, también en texto. No hay voz sintética ni un bucle más largo.


Cadena de llamadas al modelo de lenguaje (todas con salida JSON, todas desde

services/llm.py ):

- 1. Evaluador de contenido: recibe transcripción, contexto y rúbrica; devuelve estructura, coherencia y puntos débiles. Se llama una vez por ensayo.

- 2. Jurado: recibe transcripción, perfil elegido, contexto y rúbrica; devuelve exactamente 3 preguntas. Se llama una vez por ensayo.

- 3. Redactor del reporte: recibe métricas, eventos y rúbrica; devuelve 3 recomendaciones. Se llama una vez por ensayo.

- 4. Repregunta: recibe la pregunta, la respuesta transcrita y el contexto; devuelve exactamente 1 repregunta. Se llama una vez por pregunta, hasta 3 veces por ensayo.

## Perfiles de jurado

| Perfil | Archivo | Qué busca |
| --- | --- | --- |
| Exigente | jurado_exigente.md | Rigor: supuestos sin sustento, límites no |
|   |   | reconocidos |
| Curioso | jurado_curioso.md | Entender, con tono amable |
| Formal | jurado_formal.md | Estructura, tiempo y claridad según la |
|   |   | rúbrica |
| Público | jurado_publico_general.md | Si se entiende sin tecnicismos |
| general |   |   |

Las instrucciones de cada paso viven en backend/app/prompts/ : los cuatro perfiles más

evaluador_contenido.md , reporte.md , repregunta.md y

rubrica_predeterminada.md . Las escribe y prueba Diego; Erick las conecta.

La respuesta del estudiante a cada pregunta es hablada: el frontend graba solo esa respuesta y la envía a /api/repregunta , que la transcribe y devuelve la repregunta.

## Historial local de ensayos

Cada ensayo se guarda en el almacenamiento local del navegador, sin cuenta ni servidor, y se usa para listar "Mis ensayos" y comparar contra el anterior.

- Qué se guarda: la respuesta de /api/analizar más la fecha y el contexto, y luego las repreguntas del jurado cuando se generan. No se guarda el video; guardar el audio es opcional y también queda solo en el dispositivo.

- Módulo: frontend/src/storage/historial.ts , con funciones para guardar un ensayo, listarlos, obtener el anterior y borrar todo.


- Uso: el Reporte compara contra el ensayo anterior (por ejemplo, el número de muletillas) y Inicio lista los ensayos guardados. Un botón "Borrar mis datos" elimina todo.

- Limitación: si el usuario limpia los datos del navegador, pierde el historial.

## Contrato de datos

Frontend y backend se hablan con dos rutas multipart/form-data y un dato central, el evento; la copia oficial vive en docs/contrato-datos.md y debe reflejar esta versión.

POST /api/analizar . Entra: audio (archivo del ensayo), contexto y eventos_cliente

(lista de eventos medidos en el navegador, en JSON).

```
{
"presentacion": "Sustentación de tesis ante 3 profesores",
"jurado": "exigente",
"rubrica": "texto opcional; vacío usa la predeterminada"
}
```

## Sale:

```
{
"duracion": 180,
"rubrica_usada": "predeterminada",
"puntajes": { "voz": 78, "cuerpo": 64, "contenido": 81, "total": 74 },
"eventos": [
{ "t": 80, "tipo": "mirada_baja", "origen": "video", "detalle": "5 s sin
contacto visual" }
],
"transcripcion": [ { "palabra": "hola", "inicio": 0.4, "fin": 0.7 } ],
"recomendaciones": ["texto 1", "texto 2", "texto 3"],
"preguntas_jurado": ["pregunta 1", "pregunta 2", "pregunta 3"]
}
```

POST /api/repregunta . Entra: audio (respuesta hablada a una pregunta), pregunta (texto) y contexto (igual que arriba). Sale una sola repregunta:

```
{ "transcripcion_respuesta": "texto", "repregunta": "texto" }
```

## Valores permitidos

```
jurado : exigente , curioso , formal , publico_general .
```

- rubrica_usada : predeterminada , personalizada .


- tipo de evento: mirada_baja , postura_inestable , manos_ocultas , volumen_bajo , volumen_alto , pausa_larga , ritmo_rapido , ritmo_lento , muletilla .

- desde el inicio. origen : video (Carlo), audio (Erick) o transcripcion (Erick). t son segundos

Regla de trabajo. Mientras una parte no esté lista, el frontend usa datos de ejemplo con este mismo formato y el backend se prueba con las grabaciones de samples/ . Un cambio al contrato se avisa al grupo.

## Estructura de carpetas

Es un monorepo con tres zonas: frontend/ (interfaz y análisis en el navegador), backend/ (IA y transcripción) y los acuerdos del equipo ( docs/ , samples/ ).

```
evalia/
├── README.md guía rápida, cómo correr y reparto
├── CLAUDE.md, AGENTS.md instrucciones para asistentes de IA
├── .gitignore protege .env, node_modules, __pycache__
├── docs/
│ └── contrato-datos.md formato de datos frontend y backend
├── samples/ audios de prueba con muletillas contadas a mano
├── frontend/
│ ├── package.json, pnpm-lock.yaml, vite.config.ts, tsconfig.json,
index.html
│ ├── public/
│ └── src/
│ ├── App.tsx variable paso: inicio, grabacion, reporte, jurado
│ ├── main.tsx, index.css
│ ├── assets/ logo y hero de Evalia
│ ├── pages/ Inicio.tsx, Grabacion.tsx, Reporte.tsx, Jurado.tsx
│ ├── components/ tarjetas de puntaje, línea de tiempo, medidores
│ ├── storage/ historial.ts (historial en el navegador)
│ ├── api/ analizar y repreguntar, más datos de ejemplo
│ ├── types/ tipos TypeScript del contrato de datos
│ └── analysis/
│ ├── audio/ grabación, volumen, pausas, ritmo
│ └── video/ mirada, postura, gestos (MediaPipe)
└── backend/
├── .env.example plantilla de claves, sin valores
├── requirements.txt
└── app/
├── main.py arranque de FastAPI
```


```
├── routers/ analizar.py, repregunta.py
├── services/ transcribe.py, muletillas.py, llm.py, reporte.py
└── prompts/ perfiles de jurado, evaluador, reporte,
repregunta, rúbrica
```

| Zona | Carpetas | Dueño |
| --- | --- | --- |
| Interfaz | pages/ , components/ , storage/ , api/ | Diego |
| Análisis de audio | frontend/src/analysis/audio/ | Erick |
| Análisis de video | frontend/src/analysis/video/ | Carlo |
| Backend de IA | backend/app/routers/ , backend/app/services/ | Erick |
| Instrucciones de la IA | backend/app/prompts/ | Diego |
| Acuerdos | docs/ , samples/ , types/ , README.md | Los tres |

## Convenciones, orden de construcción y supuestos

## Convenciones de código (cuentan para el 15 % de calidad técnica)

- Un archivo por responsabilidad y módulos pequeños; los tipos de TypeScript salen del contrato de datos.

- Una rama por persona ( diego/frontend , erick/audio , carlo/video ); a main solo pasa lo que funciona; commits pequeños con mensajes claros.

- Se usa pnpm, no npm ni yarn. Ninguna clave en el repositorio.

- Toda llamada al backend o al modelo lleva manejo de errores: tiempo límite, mensaje claro al usuario y un camino que no rompa el flujo, porque el flujo principal sin fallas pesa 30 puntos.

- El README.md explica cómo correr frontend y backend.

## Orden de construcción para hoy

- 1. Esqueleto del repositorio y las 4 pantallas con datos de ejemplo que respeten el contrato.

- 2. Backend mínimo con /api/analizar y /api/repregunta devolviendo datos fijos, para integrar temprano.

- 3. Grabación de cámara y micrófono, métricas de audio y de video en el navegador.

- 4. Transcripción, muletillas y llamadas reales al modelo (evaluador, jurado, reporte).

- 5. Jurado en texto con repregunta, y rúbrica personalizada.

- 6. Historial local.


- 7. Pruebas del flujo completo tres veces seguidas y corrección de errores.

## Supuestos a confirmar

- La respuesta del estudiante a cada pregunta es hablada (se graba y se transcribe), como en el diseño anterior; si prefieren que sea escrita, /api/repregunta recibe texto en vez de audio.

- La repregunta se responde en voz alta sin volver a llamar al backend; el estudiante pasa con "Siguiente pregunta". PL
