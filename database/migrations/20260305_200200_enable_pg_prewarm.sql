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

-- Migration: Enable pg_prewarm for HNSW index cold-start elimination
--
-- After every PostgreSQL restart, shared_buffers (the in-memory buffer cache) is
-- empty. The HNSW vector indexes (idx_embeddings_hnsw, idx_embeddings_image_hnsw)
-- must be read from disk into memory before ANN searches run at full speed.
-- The first few RAG vector searches after a container restart are therefore
-- significantly slower (disk I/O bound) than subsequent ones (cache hit).
--
-- pg_prewarm reads specified relations or indexes into the buffer cache at startup,
-- eliminating this cold-start window.
--
-- INTEGRATION: The server startup sequence calls db.prewarmHnswIndexes() after
-- migrations complete (see server/src/index.js and server/src/config/database.js).
-- The prewarm runs asynchronously and does not block the server from accepting
-- requests — it simply front-loads the disk I/O that would otherwise happen on
-- the first user-triggered vector search.
--
-- NOTES:
--   - pg_prewarm is part of postgresql17-contrib, already installed in the image.
--   - No shared_preload_libraries entry needed (dynamically loaded).
--   - prewarm() returns the number of blocks loaded. For small embedding tables,
--     expect O(100-1000) blocks. Progress is logged at server startup.
--   - If the HNSW indexes don't exist yet (e.g. before any embeddings are
--     generated), pg_prewarm returns 0 (no-op). The server code handles this
--     gracefully via try/catch.

CREATE EXTENSION IF NOT EXISTS pg_prewarm;
