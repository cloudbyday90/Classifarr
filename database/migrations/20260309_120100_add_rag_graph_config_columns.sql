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

-- Migration: Add RAG graph retrieval configuration columns to ai_provider_config
--
-- Issue 286: All RAG settings live in the single-row ai_provider_config table (id=1).
-- This migration adds graph-retrieval-specific toggles and tuning parameters following
-- the same pattern as existing rag_* and image_embedding_* columns.
--
-- New columns:
--   rag_graph_enabled boolean DEFAULT false
--     Master toggle. When false (default), graphSearch() is never called and existing
--     hybridSearch behavior is completely unchanged. Safe to deploy before backfill.
--
--   rag_graph_weight numeric(4,2) DEFAULT 0.20
--     RRF contribution weight for graph results in 3-way weighted RRF fusion.
--     Range 0.0–1.0. At 0.20 a top-1 graph hit adds ~20% of what a top-1 vector hit adds.
--     At 1.0 graph contributes equally to vector/text.
--
--   rag_graph_collection_enabled boolean DEFAULT true
--     Include franchise/collection hits (collection_id equality). High precision; on by default.
--
--   rag_graph_director_enabled boolean DEFAULT true
--     Include director/showrunner hits. Moderate precision for auteur-driven content; on by default.
--
--   rag_graph_studio_enabled boolean DEFAULT false
--     Include production studio hits. Higher false-positive rate (large studios produce many
--     unrelated titles); off by default for noise reduction.
--
--   rag_graph_cast_enabled boolean DEFAULT false
--     Include cast overlap hits. High recall but high noise (same actor in unrelated genres);
--     off by default.
--
--   rag_graph_genre_enabled boolean DEFAULT false
--     Include genre overlap hits. Very high noise (most libraries span only 2-3 genres);
--     off by default.
--
--   rag_graph_min_matches_to_apply integer DEFAULT 1
--     Minimum number of graph candidate rows returned before including graph signal in
--     RRF fusion. With 0 graph hits the graph track contributes nothing regardless of
--     this setting; this guard avoids injecting a single very weak hit.
--
--   rag_graph_candidates_limit integer DEFAULT 20
--     Maximum graph candidates passed to RRF per hybridSearch call. Matches typical
--     top_k used for semantic and full-text paths. Operator-tunable.

ALTER TABLE ai_provider_config
    ADD COLUMN IF NOT EXISTS rag_graph_enabled boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS rag_graph_weight numeric(4,2) DEFAULT 0.20,
    ADD COLUMN IF NOT EXISTS rag_graph_collection_enabled boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS rag_graph_director_enabled boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS rag_graph_studio_enabled boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS rag_graph_cast_enabled boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS rag_graph_genre_enabled boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS rag_graph_min_matches_to_apply integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS rag_graph_candidates_limit integer DEFAULT 20;
