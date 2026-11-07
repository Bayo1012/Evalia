import type { LandmarksVideo } from './interfaces';

/** Canvas con la misma proporción que el video; espejar ambos por CSS si se desea. */
export function dibujarLandmarks(canvas: HTMLCanvasElement, landmarks: LandmarksVideo): void {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#38bdf8';
    for (const punto of [...landmarks.rostro, ...landmarks.pose]) {
      if (!Number.isFinite(punto.x) || !Number.isFinite(punto.y) || punto.visibility < 0.5) continue;
      ctx.beginPath(); ctx.arc(punto.x * canvas.width, punto.y * canvas.height, 2, 0, Math.PI * 2); ctx.fill();
    }
  } catch { /* El overlay no debe interrumpir una grabación. */ }
}
