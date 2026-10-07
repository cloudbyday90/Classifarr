/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Keep native parsing separate from validation/assembly for allocation attribution. */
export function parseInventoryDescriptionVector(encoded) {
  return JSON.parse(encoded);
}
