/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { applyPgvectorRecallSettings, resolvePgvectorRecallTuning } from './pgvectorRecallTuning.mjs';

export async function executeSemanticVectorSearch(db, { vectorString, imageVectorString, textWeight, imageWeight, candidateLimit, limit, recallTuning }) {
  return db.withTransaction(async (client) => {
    await applyPgvectorRecallSettings(client, recallTuning ?? resolvePgvectorRecallTuning());
    return client.query(`
            WITH candidates AS (
                SELECT
                    ce.id,
                    ce.classification_id,
                    ch.title,
                    ch.media_type,
                    ch.library_id,
                    COALESCE(ch.library_name, l.name) AS library_name,
                    ch.status,
                    ch.method,
                    ch.confidence,
                    ch.created_at,
                    1 - (ce.embedding <=> $1::vector) as text_similarity,
                    ce.image_embedding
                FROM classification_embeddings ce
                JOIN classification_history ch ON ce.classification_id = ch.id
                LEFT JOIN libraries l ON l.id = ch.library_id
                WHERE ce.is_stale = false
                AND ch.library_id IS NOT NULL
                ORDER BY ce.embedding <=> $1::vector
                LIMIT $5
            )
            SELECT
                c.id,
                c.classification_id,
                c.title,
                c.media_type,
                c.library_id,
                c.library_name,
                c.method,
                c.confidence,
                c.created_at,
                c.text_similarity,
                CASE
                    WHEN $2::vector IS NULL OR c.image_embedding IS NULL THEN NULL
                    ELSE 1 - (c.image_embedding <=> $2::vector)
                END as image_similarity,
                CASE
                    WHEN $2::vector IS NULL OR c.image_embedding IS NULL
                        THEN c.text_similarity
                    ELSE
                        ($3 * c.text_similarity) +
                        ($4 * (1 - (c.image_embedding <=> $2::vector)))
                END as combined_similarity
            FROM candidates c
            ORDER BY combined_similarity DESC
            LIMIT $6
        `, [vectorString, imageVectorString, textWeight, imageWeight, candidateLimit, limit]);
  });
}

export function mapSearchResults(rows, { textWeight, imageWeight, threshold, applyThreshold }) {
  if (rows.length === 0) {
    return { matches: [], allBelowThreshold: false };
  }

  const normalizedTextWeight = Math.round(textWeight * 100) / 100;
  const normalizedImageWeight = Math.round(imageWeight * 100) / 100;
  const filteredRows = applyThreshold
    ? rows.filter((row) => row.combined_similarity >= threshold)
    : rows;
  const matches = filteredRows
    .map((row) => ({
      classificationId: row.classification_id,
      title: row.title,
      mediaType: row.media_type,
      libraryId: row.library_id,
      libraryName: row.library_name,
      status: row.status,
      method: row.method,
      confidence: row.confidence,
      similarity: Math.round(row.combined_similarity * 100) / 100,
      textSimilarity: Math.round((row.text_similarity ?? 0) * 100) / 100,
      imageSimilarity: row.image_similarity === null || row.image_similarity === undefined
        ? null
        : Math.round(row.image_similarity * 100) / 100,
      textWeight: normalizedTextWeight,
      imageWeight: normalizedImageWeight,
      date: row.created_at,
    }));

  const allBelowThreshold = applyThreshold && matches.length === 0 && rows.length > 0;
  return { matches, allBelowThreshold };
}
