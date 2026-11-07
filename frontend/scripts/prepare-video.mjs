import { mkdir, cp, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../public/mediapipe/", import.meta.url);
await mkdir(new URL("models/", root), { recursive: true });
await cp(
  new URL("../node_modules/@mediapipe/tasks-vision/wasm/", import.meta.url),
  new URL("wasm/", root),
  { recursive: true },
);
for (const [name, url] of [
  [
    "face_landmarker.task",
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  ],
  [
    "pose_landmarker_lite.task",
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  ],
]) {
  const target = new URL(`models/${name}`, root);
  try {
    await access(target);
    console.log(`${name}: ya disponible`);
    continue;
  } catch {}
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok)
    throw new Error(`No se pudo descargar ${name}: ${response.status}`);
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));
  console.log(`${name}: descargado`);
}
console.log(`Recursos locales preparados en ${fileURLToPath(root)}`);
