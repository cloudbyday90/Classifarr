/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// The scheduler owns the bounded service. This slot carries no model or media data.
let current = null;
export function installRepresentativeShadow(service) {
  current = service;
  return () => { if (current === service) current = null; };
}
export function rememberRepresentativeQuery(metadata, query) {
  try { current?.remember(metadata, query); } catch { /* Observation cannot break retrieval. */ }
}
export function observeRepresentativeDecision(input) {
  try { current?.observe(input); } catch { /* Observation cannot change routing. */ }
}
export function readRepresentativeShadow() {
  try { return current?.read() ?? null; } catch { return null; }
}
