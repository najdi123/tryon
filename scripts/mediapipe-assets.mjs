// Puts the on-device hair model's files under public/mediapipe so the app serves them itself:
// nothing is fetched from a foreign host while a customer waits. The WASM runtime is copied from
// the installed package; the model file is downloaded once. A failure here never fails the install.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "public/mediapipe";
const WASM_SRC = "node_modules/@mediapipe/tasks-vision/wasm";
const MODEL = "selfie_multiclass_256x256.tflite";
const MODEL_URL = `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/${MODEL}`;

try {
  mkdirSync(join(OUT, "wasm"), { recursive: true });
  for (const f of readdirSync(WASM_SRC)) copyFileSync(join(WASM_SRC, f), join(OUT, "wasm", f));
  const target = join(OUT, MODEL);
  if (!existsSync(target) || statSync(target).size < 100_000) {
    const r = await fetch(MODEL_URL, { signal: AbortSignal.timeout(120_000) });
    if (!r.ok) throw new Error(`model download ${r.status}`);
    writeFileSync(target, Buffer.from(await r.arrayBuffer()));
  }
  process.stdout.write(`mediapipe assets ready (${statSync(target).size} bytes model)\n`);
} catch (e) {
  process.stdout.write(`mediapipe assets NOT ready: ${e instanceof Error ? e.message : String(e)}. Run "npm run assets" again; until then previews use the image service only.\n`);
}
