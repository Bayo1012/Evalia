# Análisis de video — Carlo

Módulo local para Evalia. No graba, sube ni envía video/audio. Emite eventos del
contrato de `AGENTS.md`; no calcula puntajes del reporte ni llama al backend.
La mirada es una estimación con iris, blendshapes y orientación, no seguimiento
ocular clínico. Los umbrales son de partida para la demo, no valores validados.

## Integración con el frontend

El frontend ya incluye React/Vite, el tipo compartido `Evento`, MediaPipe 0.10.32
y los recursos locales. `Grabacion.tsx` consume el hook, dibuja los landmarks y
combina los eventos de video/audio al detener. No se cambió el contrato de datos.

La página prepara el video, espera a que arranque el adaptador de audio y llama a
`sincronizarInicio(performance.now())` para alinear cronómetro, calibración y eventos.
El mock se inicia y reinicia también en modo demo, sin cámara ni modelos.
`fiable` controla si se muestran métricas: un aviso informativo de CPU no las oculta.

Pendiente de Erick: registrar su `AdaptadorAudio` mediante
`registrarAdaptadorAudio` antes de montar App. Mientras no exista, Inicio mantiene
deshabilitado el ensayo real. Los tests de integración usan un adaptador de prueba;
no se agregó una implementación de audio de producción.

Si faltan recursos en otro equipo, ejecutar `pnpm setup:video` desde `frontend/`.
No mezclar WASM de otra versión del paquete. Descargar antes de la demo;
no se usa CDN en ejecución.

## Recursos locales exactos

Desde `frontend/`, una vez configurado su `package.json` (comandos para Diego):

```powershell
pnpm add @mediapipe/tasks-vision@0.10.32
pnpm add -D vitest@3.2.4
New-Item -ItemType Directory -Force public/mediapipe/wasm, public/mediapipe/models
Copy-Item node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/wasm/
Invoke-WebRequest 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' -OutFile public/mediapipe/models/face_landmarker.task
Invoke-WebRequest 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' -OutFile public/mediapipe/models/pose_landmarker_lite.task
```

Los cuatro archivos WASM/loader de esa versión son:

- `public/mediapipe/wasm/vision_wasm_internal.js`
- `public/mediapipe/wasm/vision_wasm_internal.wasm`
- `public/mediapipe/wasm/vision_wasm_nosimd_internal.js`
- `public/mediapipe/wasm/vision_wasm_nosimd_internal.wasm`

Modelos: `public/mediapipe/models/face_landmarker.task` y
`public/mediapipe/models/pose_landmarker_lite.task`. Rutas de ejecución en `config.ts`;
si la app vive en un subdirectorio, adaptar allí las tres rutas. Servir JS y WASM
como archivos reales (no el HTML del fallback de Vite). HTTPS o localhost para cámara.

Referencias oficiales: [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
y [Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

## Interfaz para Grabacion.tsx

```tsx
const videoRef = useRef<HTMLVideoElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
const analisis = useAnalisisVideo(videoRef, { mock: false });

useEffect(() => {
  if (canvasRef.current) dibujarLandmarks(canvasRef.current, analisis.landmarks);
}, [analisis.landmarks]);

// En Comenzar: await analisis.iniciar(); await adaptadorAudio.iniciar(...);
// Después: const inicio = performance.now(); analisis.sincronizarInicio(inicio);
// Cronómetro y calibración comparten ese origen de tiempo.
// En Detener: const eventosVideo = analisis.detener(); combinar con los de audio.
// Renderizar <video ref={videoRef} muted playsInline /> y el canvas superpuesto.
```

Importar `useAnalisisVideo` y `dibujarLandmarks` desde el índice de esta carpeta.
Renderizar el video antes de llamar a `iniciar()`. El canvas debe tener dimensiones
intrínsecas iguales a `videoWidth`/`videoHeight` y la misma proporción y ajuste CSS;
si se espeja, espejar ambos. Un canvas con `object-fit: cover` desalineado requiere
que la página coordine el recorte. Vaciar el overlay con los landmarks vacíos al parar.

- `estado`: `cargando`, `listo`, `error`. Antes de iniciar está `listo` con aviso de
  que aún no se analiza. `listo` también permite mostrar la calibración en progreso.
- `error`: mensaje o `null`; `aviso`: mensaje de calibración, CPU, demo o señal incierta.
- `calibrando`: mostrar instrucción de mirar a cámara con hombros visibles.
- `fiable`: muestra válida de rostro y postura. No inferir fiabilidad desde `aviso`;
  CPU o modo demo pueden tener aviso y métricas válidas a la vez.
- `metricas`: `contactoVisual` y `postura` (0–100), estimaciones instantáneas.
  Cero con aviso de calibración/señal incierta significa **sin medición**, no un
  puntaje para penalizar. Para el reporte se usan exclusivamente los eventos.
- `landmarks`: `{ rostro, pose }`, sólo el último frame; no se acumulan imágenes.
- `iniciar(): Promise<void>`: idempotente mientras carga o analiza; resuelve también
  ante error para no bloquear el flujo. Mostrar `error`/`aviso` al usuario.
- `detener(): Evento[]`: cierra episodios, cancela el bucle y libera recursos.
  Repetirla devuelve una copia del mismo resultado, no eventos nuevos.
- `reiniciar(): Promise<void>`: detiene, borra datos anteriores y comienza otra sesión.
- `sincronizarInicio(inicioMs): void`: al arrancar el audio, establece el origen común
  usando `performance.now()` y borra la calibración/eventos anteriores al ensayo.
  No reactiva un análisis que haya fallado. Llamarla una sola vez por grabación.

`t` es el inicio del episodio, en segundos desde el origen sincronizado del ensayo;
incluye el período de calibración. Sin sincronización explícita usa el fin de la
preparación del video. Si el análisis falla, su promesa resuelve y el audio puede
empezar de todos modos.

Mock: `{ mock: true }` o `VIDEO_CONFIG.mock = true`. No pide cámara ni carga modelos;
marca las métricas como simuladas. Tras 8 s devuelve un evento de ejemplo desde el
segundo 2 con duración de 6 s; antes devuelve `[]`. No usar sus datos en evaluación real.

## Cámara, cancelación y errores

Si el video no tiene stream, el módulo abre **sólo video**, sin micrófono, y detiene
todos sus tracks al parar, reiniciar, fallar o desmontar. Si `video.srcObject` ya
tiene un stream de cámara activo, se toma prestado: **Diego/Erick deben parar ese
stream al terminar la grabación o salir a Inicio**. El análisis no corta tracks
compartidos con MediaRecorder. No cambiar el stream mientras analiza.

Carga modelos con GPU y reintenta ambos en CPU si falla la inicialización; cierra
instancias parciales. Un fallo durante inferencia desactiva el análisis y devuelve
`[]`, con aviso. También cubre permiso denegado, cámara ocupada, ausencia de cámara,
modelo ausente, ausencia de cuadros y tiempo de preparación mayor de 20 s.
Los recursos asíncronos que lleguen después de cancelar se liberan al resolverse.
Las promesas del navegador/MediaPipe no pueden interrumpirse internamente, pero no
reactivan una sesión terminada. Ningún recurso GPU se puede validar sólo con tests.

## Umbrales y comportamiento

Todos los umbrales de detección están en `config.ts`:

| Parámetro | Inicial | Significado |
| --- | --- | --- |
| `fps` | 5 | Máximo aproximado; la inferencia síncrona puede reducirlo |
| `calibracionSegundos` | 3 s | Muestras estables y frontales para línea base |
| `calibracionLimiteSegundos` | 12 s | Sin base fiable: aviso y análisis desactivado |
| `miradaSegundos` | 5 s | Exige más de 5 s; no emite un evento por frame |
| `manosSegundos` | 3 s | Una o ambas muñecas poco visibles/fuera de cuadro |
| `posturaSegundos` | 2 s | Balanceo persistente, no postura fija desplazada |
| `posturaVentana` | 2 s | Rango del movimiento de hombros respecto a su ancho base |
| `recuperacionSegundos` | 0.6 s | Recuperación sostenida antes de cerrar episodio |
| `huecoMaximo` | 0.8 s | Señal desconocida breve tolerada; huecos largos no suman duración |
| `suavizadoMuestras` | 3 | Media móvil para mirada |

Mirada compara orientación yaw/pitch, iris y blendshapes contra la base; descarta
parpadeos y ojos demasiado cerrados. Postura usa el centro y la inclinación de los
hombros como proxy del torso, incluso si las caderas quedan fuera de cámara.
Muñecas invisibles con torso detectable producen `manos_ocultas`; si desaparece el
cuerpo completo la señal es desconocida, no se inventa un evento. Esto evalúa
visibilidad en cámara, no calidad de gesticulación.

Para calibrar umbrales, probar primero un ensayo neutro con buena luz y luego uno
con episodios conocidos; cambiar una familia de umbrales cada vez. Subir entrada o
duración reduce sensibilidad; mantener salida por debajo de entrada para histéresis.
La postura frontal estable no demuestra por sí sola que se mire al objetivo:
anteojos/reflejos y cámaras descentradas requieren prueba manual. No se ha medido
precisión con personas ni se garantiza ausencia de falsos positivos.

## Verificación y demo

Una vez integrado el frontend: `pnpm exec vitest run src/analysis/video` y `pnpm build`.
Tests incluidos: umbrales estrictos, histéresis, señal desconocida, calibración,
un episodio sostenido de 10 minutos simulados, GPU→CPU, permisos/modelos tardíos,
cancelación, repetición de ensayos, limpieza de tracks propios y stream prestado.
Los tests y el build ahora se ejecutan en el frontend real, con su tipo compartido.
Las pruebas de navegador de integración están en `tests/e2e/video.integration.spec.ts`;
separan la conexión de la pantalla (dobles controlados) de la carga de modelos reales.
No sustituyen la validación de precisión con una persona ni la implementación de audio.

Probar manualmente antes de demo:

- Buena/poca luz, anteojos, reflejos, cabello en la cara y distintas distancias.
- Parpadear y girar la cabeza brevemente: sin eventos; desviar más de 5 s y volver:
  exactamente un evento. Detener durante un episodio debe incluirlo una sola vez.
- No mirar durante calibración: no aceptar una base claramente girada; al superar
  12 s mostrar aviso y continuar el ensayo con eventos vacíos.
- Muñecas fuera/dentro de cuadro; torso ausente no cuenta como manos ocultas.
- Permiso denegado, cámara ocupada, modelo ausente, WebGL fallando y modo CPU.
- Iniciar/detener rápidamente, salir mientras carga y tres ensayos seguidos.
- Volver a Inicio: cámara propia apagada; cámara prestada cerrada por su dueño.
- Ensayo real de 10 min: revisar FPS, memoria y respuesta de la UI. El bucle es
  limitado a 5 FPS pero corre en el hilo principal; no hay worker en este MVP.
- Con recursos locales ya instalados, desconectar wifi y verificar carga de modelos.

Commits sugeridos para `carlo/video` (sin commits automáticos):

1. `feat(video): definir hook público y mock de integración`
2. `feat(video): cargar modelos locales y gestionar cámara con cancelación`
3. `feat(video): calibrar mirada y detectar episodios de cuerpo`
4. `test(video): cubrir detección y ciclo de vida; documentar integración`
