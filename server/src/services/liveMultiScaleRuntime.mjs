/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Lifecycle slot only: the scheduler-owned service contains the bounded cache.
let current = null;
export function installLiveMultiScaleContext(service) {
  current = service;
  return () => { if (current === service) current = null; };
}
export async function retrieveLiveMultiScaleExamples(input) {
  try { return await current?.retrieve(input) ?? null; } catch { return null; }
}
