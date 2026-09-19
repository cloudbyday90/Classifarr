/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fixture } from './inventoryMultiScaleFixture.mjs';

export function resultFor(snapshot, doc, held) {
  return { purpose: 'retrieval_context_only', candidates: snapshot.libraries.filter(row => row.media_type === doc.type).map(library => {
    const rows = snapshot.corpus.documents.filter(row => row.type === doc.type && row.libraryIds.length === 1 &&
      row.libraryIds[0] === library.id && !held.has(row.hash)).slice(0, 6).map((row, index) => ({ hash: row.hash,
      similarity: 0.9 - index / 100, origins: [index < 3 ? 'raw' : 'broad'] }));
    return { id: library.id, raw: rows.slice(0, 3), evidence: rows };
  }) };
}

export function caseFixture() {
  const snapshot = fixture(), doc = snapshot.corpus.documents[0], held = new Set([doc.hash]);
  return { snapshot, doc, held, result: resultFor(snapshot, doc, held) };
}

export const identity = { model: 'local:test', digest: 'b'.repeat(64), contextLength: 32768 };
export const generationResult = { response: '{"candidate":0}', latencyMs: 2, promptTokens: 100, outputTokens: 5 };
