/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
let running = false;

/** Both manual routes share one slot per API process. */
export async function tryRunManualSuggestionAnalysis(work) {
  if (running) return false;
  running = true;
  try {
    await work();
    return true;
  } finally {
    // The command may still be running after its client disconnects.
    running = false;
  }
}
