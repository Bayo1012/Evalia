# Evalia

Frontend para ensayar exposiciones y practicar preguntas de jurado. React 19, TypeScript, Vite, Tailwind CSS v4 y Motion. Cuatro pantallas por estado en `App.tsx`, sin router.

## Ejecutar localmente

Requisitos: Node.js 20.19+ (o 22.12+) y pnpm 10. Se fija pnpm 10.0.0 en `package.json`.

```powershell
cd C:\Users\Carlo\OneDrive\Documentos\PROYECTO\Evalia\frontend
pnpm install
pnpm dev
```

Abrir la URL que imprime Vite (por defecto http://127.0.0.1:5173). `pnpm build` comprueba TypeScript y genera `frontend/dist`. `pnpm preview` permite inspeccionar ese build.

## Ensayo

Inicio muestra directamente la configuración del ensayo real, sin selector de demostración. Activa cámara y micrófono, calibra y comienza cuando quieras. Los nuevos reportes y recomendaciones se generan desde el audio enviado al backend. Los datos de demostración se conservan como fixtures internos y los reportes antiguos siguen disponibles en el historial.

Las recomendaciones usan la transcripción, la evaluación y la rúbrica de ese ensayo; los títulos ya no son fijos. Se pide evidencia de lo dicho y acciones concretas aplicadas a su contenido.

## Integración real

El modo real ya registra el grabador de audio del navegador y se conecta con FastAPI. Inicio usa directamente cámara, micrófono e IA para el ensayo real.

En una terminal desde la raíz del repositorio:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
# Crear backend/.env tomando backend/.env.example como plantilla y completar GROQ_API_KEY.
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

En otra terminal:

```sh
cd frontend
pnpm install
pnpm setup:video
pnpm dev
```

`pnpm dev` inicia el frontend; FastAPI debe estar ejecutándose en la otra terminal. El backend carga `backend/.env` automáticamente. Al detener la grabación se envía únicamente audio y eventos; el reporte devuelve el contrato compartido y el jurado transcribe cada respuesta hablada para generar una repregunta. El ritmo se calcula después de la transcripción, no durante la grabación. En Inicio, activa cámara y micrófono y mira a la cámara con los hombros visibles durante 3 segundos para calibrar. Después pasa a grabación e inicia cuando quieras; se reutiliza la calibración. Si falla, puedes reintentar o continuar sin análisis de video.

Si aparece un error indicando que falta `GROQ_API_KEY`, completa esa variable en `backend/.env` y reinicia FastAPI. El archivo `.env.example` es solo una plantilla y no configura el servicio por sí mismo.

El cliente ya prepara `POST /api/analizar` y `POST /api/repregunta` con multipart. El proxy de Vite apunta a `http://127.0.0.1:8000`; opcionalmente configurar `VITE_API_URL` (ver `frontend/.env.example`). Esta URL es pública; nunca colocar claves en variables VITE_. Para producción hay que servir `/api` o configurar esa URL y CORS.

Carlo: los archivos existentes de `frontend/src/analysis/video` se conservaron. `pnpm setup:video` descarga modelos y copia WASM a `public/mediapipe`; se sirven localmente. No hace falta para la demo.

## Verificar

```powershell
cd frontend
pnpm build
pnpm test
pnpm test:e2e
```

Las pruebas de navegador usan Chrome instalado (configurable en `playwright.config.ts`) y arrancan/reutilizan Vite. Cubren tres recorridos consecutivos en escritorio, uno móvil (390 px), descarte, error/reintento, una solicitud por pregunta, historial tras recarga, borrado, campos obligatorios y ausencia de peticiones de medios en demo. Las pruebas de Vitest incluyen las existentes de Carlo y el contrato multipart del cliente.

Las fuentes Sora y Manrope se sirven desde dependencias locales. Los JPG adjuntos se conservaron sin cambios en `src/assets`. Tema en `src/styles/theme.css`, composición y responsive en `src/styles/app.css`. Motion y CSS respetan `prefers-reduced-motion`.

## Mapa de implementación

- `frontend/src/App.tsx`: navegación, contexto, intento, persistencia y coordinación.
- `frontend/src/pages/`: Inicio, Grabacion, Reporte y Jurado.
- `frontend/src/components/`: identidad, robot, cabecera, botones, barras y vista simulada.
- `frontend/src/api/`: cliente real, servicios intercambiables y fixtures demo separados.
- `frontend/src/types/index.ts`: contrato compartido, incluyendo `Evento` requerido por Carlo.
- `frontend/src/storage/historial.ts`: historial versionado, hasta 30 ensayos, sin blobs.
- `frontend/src/integrations/audio.ts`: punto de conexión de Erick.
- `frontend/src/analysis/video/`: módulo original de Carlo, consumido por Grabacion.

El módulo de video de Carlo se conserva sin cambios.

Si Groq alcanza temporalmente el límite de tokens por minuto, el backend espera lo indicado por el proveedor (hasta 15 segundos por espera) y reintenta solo esa llamada hasta dos veces. Jurado y recomendaciones se generan en secuencia y reciben un resumen de los eventos; la transcripción se conserva completa. Si la cuota sigue agotada o requiere una espera larga, se devuelve HTTP 429 con un mensaje para reintentar, sin perder la grabación. El cliente admite hasta 240 segundos para completar el análisis.
