export interface CamaraVideo { stream: MediaStream; propia: boolean }
export function liberarCamara(camara: CamaraVideo | null, video: HTMLVideoElement | null): void {
  if (!camara?.propia) return;
  for (const track of camara.stream.getTracks()) {
    try { track.stop(); } catch { /* intentar cerrar todos los tracks */ }
  }
  if (video?.srcObject === camara.stream) video.srcObject = null;
}
export async function abrirCamara(video: HTMLVideoElement, signal: AbortSignal): Promise<CamaraVideo> {
  signal.throwIfAborted();
  const existente = video.srcObject;
  if (existente instanceof MediaStream && existente.getVideoTracks().some(t => t.readyState === 'live'))
    return { stream: existente, propia: false };
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara requiere HTTPS o localhost y un navegador compatible.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false,
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } } });
  const camara = { stream, propia: true };
  if (signal.aborted) { liberarCamara(camara, null); signal.throwIfAborted(); }
  video.srcObject = stream;
  return camara;
}
export function mensajeError(error: unknown): string {
  const nombre = error instanceof Error ? error.name : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'Permiso de cámara denegado. Puedes continuar sin análisis de video.';
  if (nombre === 'NotReadableError') return 'La cámara está ocupada o no está disponible. Puedes continuar sin análisis de video.';
  if (nombre === 'NotFoundError') return 'No se encontró una cámara. Puedes continuar sin análisis de video.';
  return 'No se pudo analizar el video. Revisa la cámara, los modelos locales y WebGL. Puedes continuar sin este análisis.';
}
