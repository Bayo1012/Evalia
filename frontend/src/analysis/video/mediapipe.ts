import type { FaceLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { VIDEO_CONFIG as C } from './config';

export interface Modelos { rostro: FaceLandmarker; pose: PoseLandmarker; cpu: boolean }
export function cerrarModelos(modelos: Modelos | null): void {
  // Un cierre fallido no debe impedir liberar el otro detector.
  try { modelos?.rostro.close(); } catch { /* ya cerrado o contexto perdido */ }
  try { modelos?.pose.close(); } catch { /* ya cerrado o contexto perdido */ }
}
export async function cargarModelos(signal: AbortSignal): Promise<Modelos> {
  const { FaceLandmarker, PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const archivos = await FilesetResolver.forVisionTasks(C.wasm);
  for (const delegate of ['GPU', 'CPU'] as const) {
    let rostro: FaceLandmarker | null = null;
    let pose: PoseLandmarker | null = null;
    try {
      signal.throwIfAborted();
      rostro = await FaceLandmarker.createFromOptions(archivos, {
        baseOptions: { modelAssetPath: C.faceModel, delegate }, runningMode: 'VIDEO', numFaces: 1,
        outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: C.confianzaDeteccion, minFacePresenceConfidence: C.confianzaDeteccion, minTrackingConfidence: C.confianzaDeteccion,
      });
      signal.throwIfAborted();
      pose = await PoseLandmarker.createFromOptions(archivos, {
        baseOptions: { modelAssetPath: C.poseModel, delegate }, runningMode: 'VIDEO', numPoses: 1,
        outputSegmentationMasks: false, minPoseDetectionConfidence: C.confianzaDeteccion,
        minPosePresenceConfidence: C.confianzaDeteccion, minTrackingConfidence: C.confianzaDeteccion,
      });
      signal.throwIfAborted();
      return { rostro, pose, cpu: delegate === 'CPU' };
    } catch (error) {
      try { rostro?.close(); } catch { /* liberar también pose */ }
      try { pose?.close(); } catch { /* continuar sin análisis */ }
      if (signal.aborted || delegate === 'CPU') throw error;
    }
  }
  throw new Error('No se pudieron inicializar los modelos locales.');
}
