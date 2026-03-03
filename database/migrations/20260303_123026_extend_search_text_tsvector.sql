-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Extend search_text tsvector to include genre names and keyword names
-- extracted from the metadata JSONB column on classification_history.
--
-- classification_history has no standalone genre/keyword columns; all
-- enrichment data lives in the metadata JSONB field. Genre and keyword
-- entries are stored as arrays of {id, name} objects (TMDB shape), but
-- plain-string arrays are also handled safely.
--
-- This migration:
--   1. Creates a helper function to extract text from JSONB name arrays.
--   2. Replaces the update_classification_search_text() trigger function
--      to also concatenate genre and keyword text from metadata.
--   3. Backfills search_text for all existing rows.
--
-- Note: this migration assumes classification_history, its search_text column,
-- and its metadata column already exist. It will fail if any of these are missing.

-- ============================================================================
-- 1. HELPER: extract text from a JSONB array of strings or {name:...} objects
-- ============================================================================

CREATE OR REPLACE FUNCTION extract_jsonb_name_text(arr JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(
        string_agg(
            CASE
                WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
                WHEN jsonb_typeof(elem) = 'object' AND (elem ? 'name') THEN elem->>'name'
                ELSE NULL
            END,
            ' '
        ),
        ''
    )
    FROM jsonb_array_elements(
        CASE WHEN arr IS NOT NULL AND jsonb_typeof(arr) = 'array' THEN arr ELSE '[]'::jsonb END
    ) AS elem
$$;

-- ============================================================================
-- 2. UPDATE TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_classification_search_text()
RETURNS TRIGGER AS $$
DECLARE
    genre_text   TEXT := '';
    keyword_text TEXT := '';
BEGIN
    -- Extract genre names from metadata JSONB if present
    IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'genres' THEN
        genre_text := extract_jsonb_name_text(NEW.metadata->'genres');
    END IF;

    -- Extract keyword names from metadata JSONB if present
    IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'keywords' THEN
        keyword_text := extract_jsonb_name_text(NEW.metadata->'keywords');
    END IF;

    NEW.search_text := to_tsvector('english',
        COALESCE(NEW.title, '')        || ' ' ||
        COALESCE(NEW.library_name, '') || ' ' ||
        COALESCE(NEW.method, '')       || ' ' ||
        COALESCE(genre_text, '')       || ' ' ||
        COALESCE(keyword_text, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. BACKFILL EXISTING ROWS
-- ============================================================================

UPDATE classification_history
SET search_text = to_tsvector('english',
    COALESCE(title, '')        || ' ' ||
    COALESCE(library_name, '') || ' ' ||
    COALESCE(method, '')       || ' ' ||
    COALESCE(extract_jsonb_name_text(
        CASE WHEN metadata IS NOT NULL AND metadata ? 'genres'
             THEN metadata->'genres' ELSE '[]'::jsonb END
    ), '') || ' ' ||
    COALESCE(extract_jsonb_name_text(
        CASE WHEN metadata IS NOT NULL AND metadata ? 'keywords'
             THEN metadata->'keywords' ELSE '[]'::jsonb END
    ), '')
)
WHERE search_text IS NULL
   OR (metadata IS NOT NULL AND (metadata ? 'genres' OR metadata ? 'keywords'));
