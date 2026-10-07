/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { parseInventoryDescriptionVector } from './inventoryDescriptionVectorParsing.mjs';
import { observeInventoryVectorBatch } from './inventoryVectorReadDiagnostics.mjs';

export function decodeInventoryDescriptionVectorRows(rows, representation) {
  const vectors = new Map(rows.map(row => [row.description_hash,
    validateEmbedding(parseInventoryDescriptionVector(row.embedding), representation.dimensions)]));
  observeInventoryVectorBatch('decode', rows, representation.dimensions);
  return vectors;
}
