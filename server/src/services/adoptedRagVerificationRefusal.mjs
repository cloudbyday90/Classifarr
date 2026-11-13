/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const refusals = new WeakSet();
export function createAdoptedRagVerificationRefusal() {
  const error = new Error('Fresh verification context is unavailable');
  refusals.add(error);
  return error;
}
export const isAdoptedRagVerificationRefusal = error => error != null && refusals.has(error);
