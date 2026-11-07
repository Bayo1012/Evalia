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

## Demo sin backend ni permisos

El inicio selecciona **Demostración** por defecto. No pide cámara/micrófono, no graba ni hace llamadas al backend. El aviso "Modo demo: datos simulados" está presente en las cuatro pantallas.

1. Opcional: cargar el ensayo anterior con **Cargar ensayo de ejemplo** y pegar una rúbrica personalizada.
2. **Comenzar ensayo** y **Detener grabación**. El cronómetro es de práctica; el análisis simulado siempre corresponde al mismo ejemplo de 3 minutos.
3. **Descartar y volver a grabar** borra el intento, sin perder la configuración. **Analizar ensayo** muestra carga. La casilla de error falla solo la siguiente petición y permite **Reintentar análisis** con el mismo intento.
4. En el reporte, seleccionar eventos, consultar las tres recomendaciones y continuar al jurado. Si no hay historial previo, se usa el ensayo anterior simulado como comparación de demo y se identifica como tal; no se inserta en el historial automáticamente.
5. Responder cada pregunta con los controles de grabación simulada. Se muestra una transcripción y una sola repregunta. Después de las tres aparece el cierre.
6. Volver al inicio o recargar: resultados y respuestas siguen disponibles. **Borrar mis datos → Confirmar borrado** elimina el historial de esta aplicación.

La demo es determinista: cambiar tema, jurado o rúbrica no genera contenido nuevo de IA. La etiqueta de rúbrica refleja la selección, pero recomendaciones/preguntas siguen siendo ejemplos. No se inventa un video de una persona: se muestra una silueta y la ausencia de archivo se explica en el reporte.

## Integración real

Ver `docs/frontend-integracion.md`. El modo real exige permisos y el adaptador de audio registrado. Mientras falta, el botón de inicio permanece deshabilitado con un mensaje explícito. El backend de este repositorio aún contiene archivos vacíos: no hay comandos de arranque funcionales que ejecutar hasta que Erick lo implemente.

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

No se hicieron commits ni se cambió la rama activa. El código de backend y el módulo de Carlo permanecen intactos.
