import { geminiEngine } from "./gemini";
import type { HairEngine } from "./types";

export type { HairEngine, RecolorRequest, RecolorResult } from "./types";

const ENGINES: Record<string, HairEngine> = { gemini: geminiEngine };

// HAIR_ENGINE picks the engine; adding one is a new file and a line here.
export function hairEngine(): HairEngine {
  return ENGINES[process.env.HAIR_ENGINE ?? "gemini"] ?? geminiEngine;
}
