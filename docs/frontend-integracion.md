# Conectar los módulos del equipo

## Erick: grabación y métricas

Implementar el motor en `frontend/src/analysis/audio/` y registrarlo antes de montar React en `main.tsx`:

```ts
import { registrarAdaptadorAudio } from './integrations/audio';
import { adaptadorAudio } from './analysis/audio';
registrarAdaptadorAudio(adaptadorAudio);
```

La interfaz `AdaptadorAudio` de `src/integrations/audio.ts` recibe el stream ya autorizado y una función para publicar `{ volumen: number | null, ritmo: number | null }`. Volumen está normalizado a 0–100 y ritmo en palabras/minuto. Usar `null` si no existe una medición fiable; no usar datos demo en modo real.

`iniciar(stream, publicar)` devuelve una `SesionAudio`:

- `detener()` resuelve `{ audio: Blob, video?: Blob, eventos: Evento[] }`. El audio debe ser solo audio: nunca incluir el track de video en el blob que viaja al backend. Puede devolver por separado un video exclusivamente local para revisión y saltos de tiempo.
- `cancelar()` debe ser idempotente, soltar grabadores/contextos y descartar buffers, incluso al desmontar o abandonar la pantalla.
- No detener el stream compartido desde un motor sin coordinar: la interfaz lo libera después de detener los módulos, al salir o al cancelar permisos tardíos.
- La misma interfaz se usa en el jurado, esta vez con un stream solo de micrófono. La interfaz limita la duración de la exposición a 10 minutos.

No se implementó un motor alternativo de audio para evitar solapar el trabajo de Erick. En ausencia de adaptador, el modo real informa la integración pendiente.

## Carlo: cuerpo y cámara

Se importa `useAnalisisVideo` y `dibujarLandmarks` desde el índice existente, sin modificar archivos del módulo. El tipo `Evento` se exporta desde `src/types/index.ts`.

La vista adjunta el stream compartido a `<video>` antes de llamar `iniciar()`. Después de la preparación, comienza el audio y el cronómetro. Los canvas tienen tamaño intrínseco del video; video y overlay usan el mismo ajuste y espejo. Al detener, los eventos corporales se concatenan con los de audio. Fallos de video se muestran sin sustituirlos por métricas simuladas.

Ejecutar `pnpm setup:video` antes de probar el modo real. Modelos y WASM se sirven desde las rutas de `analysis/video/config.ts`. Revisar las recomendaciones manuales de `analysis/video/README.md`, especialmente calibración, GPU/CPU y permiso denegado. La demo no carga los modelos.

## Backend

`src/api/client.ts` utiliza FormData y deja que el navegador establezca el Content-Type con boundary. No usa sesión ni identificadores del servidor.

- `/api/analizar`: `audio`, `contexto` serializado, `eventos_cliente` serializado.
- `/api/repregunta`: `audio`, `pregunta`, `contexto` serializado.

Hay timeout de 60 segundos, validación de respuesta y protección inmediata de doble clic. El análisis fallido conserva el intento para reintentar. La petición de repregunta se marca **antes** de enviar: incluso si el servidor falla o hay un timeout, no se envía una segunda para esa pregunta, porque no hay idempotencia de servidor en el contrato. Se permite pasar a la siguiente y el historial conserva la marca.

Resultados y transcripciones se guardan en `evalia.ensayos.v1`. Audio/video nunca se serializan. Los ObjectURL de revisión/reporte se revocan al cambiar o desmontar. Si localStorage falla, hay un aviso y la sesión continúa en memoria. La comparación separa demos de ensayos reales y advierte cuando cambia la rúbrica.

## Verificación pendiente con el equipo

El flujo demo y el contrato HTTP se prueban automáticamente. La grabación real de Erick, el backend y las mediciones físicas de MediaPipe requieren sus implementaciones/dispositivos y una prueba integrada. El frontend no afirma que esas integraciones estén verificadas por recorrer la demo.

Referencias de implementación: [Tailwind con Vite](https://tailwindcss.com/docs/installation/using-vite) y [movimiento accesible en Motion](https://motion.dev/docs/react-accessibility).

## Archivos de contexto
Inicio incluye selección múltiple y arrastrar/soltar PPT, PPTX, PDF, DOC y DOCX (5 archivos, 20 MB cada uno). Los File permanecen en memoria de App, separados del contexto JSON y del historial. No se envían al contrato actual: el backend debe acordar un endpoint de extracción o campos multipart para documentos antes de habilitar su uso como contexto. La demo identifica esta limitación explícitamente. Componente: src/components/ArchivosContexto.tsx.

