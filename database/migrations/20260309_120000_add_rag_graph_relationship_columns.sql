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

-- Migration: Add RAG graph relationship columns to classification_history
--
-- Issue 286: Augment the RAG pipeline with a third, structurally-grounded retrieval
-- path (graph retrieval). This migration denormalizes relationship attributes from the
-- existing metadata jsonb column into indexed scalar/array columns so that graph queries
-- run on B-tree and GIN indexes rather than jsonb expression scans.
--
-- New columns:
--   director_name varchar(255)    - Normalized director/showrunner name (lowercase trim)
--   primary_studio_name varchar   - First production company name (lowercase trim)
--   genre_names text[]            - Genre name strings copied from metadata.genres
--   cast_ids integer[]            - Top-5 TMDB person IDs for fast overlap queries
--   cast_names text[]             - Top-5 cast display names (kept for display without join)
--
-- collection_id already exists and is indexed; graph queries reuse it as-is.
--
-- INDEX NOTES:
--   - director_name / primary_studio_name: partial B-tree (WHERE IS NOT NULL) to avoid
--     bloating the index with null entries from manual/source-library rows.
--   - genre_names: standard GIN with default array_ops (text[]; intarray is for integer[]).
--   - cast_ids: GIN with gin__int_ops (requires intarray extension) which is faster than
--     the default integer array_ops because it uses dedicated integer-optimized index
--     entries. IMPORTANT: gin__int_ops rejects NULL elements at query time; the application
--     layer MUST filter nulls before writing cast_ids (see ragGraphExtractor.js).
--
-- CREATE INDEX CONCURRENTLY is NOT used here because the migration runner wraps every .sql
-- in BEGIN/COMMIT and Postgres prohibits CONCURRENTLY inside a transaction block. This is
-- safe: migrations run at container startup before the HTTP server binds, so no concurrent
-- writes are in flight while indexes are being built.

-- Enable intarray for gin__int_ops on integer[] columns.
-- Ships with postgresql17-contrib which is already installed in the Dockerfile.
-- Same pattern as pg_trgm (migration 20260305_200100) and vector (migration 031).
CREATE EXTENSION IF NOT EXISTS intarray;

-- Add new relationship columns (all nullable; existing rows unmodified).
ALTER TABLE classification_history
    ADD COLUMN IF NOT EXISTS director_name varchar(255),
    ADD COLUMN IF NOT EXISTS primary_studio_name varchar(255),
    ADD COLUMN IF NOT EXISTS genre_names text[],
    ADD COLUMN IF NOT EXISTS cast_ids integer[],
    ADD COLUMN IF NOT EXISTS cast_names text[];

-- B-tree index on director_name — equality queries: director_name = $param
CREATE INDEX IF NOT EXISTS idx_classification_history_director_name
    ON classification_history (director_name)
    WHERE director_name IS NOT NULL;

-- B-tree index on primary_studio_name — equality queries: primary_studio_name = $param
CREATE INDEX IF NOT EXISTS idx_classification_history_primary_studio_name
    ON classification_history (primary_studio_name)
    WHERE primary_studio_name IS NOT NULL;

-- GIN index on genre_names (text[]) using standard array_ops.
-- Supports && (overlap) and @> (contains) operators.
-- intarray is NOT applicable to text[] — this uses the built-in array GIN.
CREATE INDEX IF NOT EXISTS idx_classification_history_genre_names
    ON classification_history USING GIN (genre_names);

-- GIN index on cast_ids (integer[]) using gin__int_ops from intarray.
-- More efficient than default array_ops for integer arrays.
-- Supports && (overlap) and @> (contains) operators.
-- CRITICAL: any NULL element in the stored array will cause a runtime error at query time.
-- The ragGraphExtractor.extract() function filters nulls before every INSERT.
CREATE INDEX IF NOT EXISTS idx_classification_history_cast_ids
    ON classification_history USING GIN (cast_ids gin__int_ops);
