/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateInventoryVector } from './inventoryVectorValidation.mjs';
import { parseInventoryDescriptionVector } from './inventoryDescriptionVectorParsing.mjs';
import { observeInventoryVectorBatch } from './inventoryVectorReadDiagnostics.mjs';

export function decodeInventoryDescriptionVectorRows(rows, representation) {
  const vectors = new Map(rows.map(row => [row.description_hash,
    validateInventoryVector(parseInventoryDescriptionVector(row.embedding), representation.dimensions)]));
  observeInventoryVectorBatch('decode', rows, representation.dimensions);
  return vectors;
}
