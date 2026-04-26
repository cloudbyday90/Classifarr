-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Image embeddings are opt-in and use the image sidecar defaults, not the
-- classification/Ollama defaults.

ALTER TABLE ai_provider_config
ALTER COLUMN image_embedding_provider_mode SET DEFAULT 'disabled';

ALTER TABLE ai_provider_config
ALTER COLUMN image_embedding_local_port SET DEFAULT 8000;

UPDATE ai_provider_config
SET image_embedding_provider_mode = 'disabled'
WHERE image_embedding_provider_mode IS NULL
   OR image_embedding_provider_mode = 'same';

UPDATE ai_provider_config
SET image_embedding_local_port = 8000
WHERE image_embedding_local_port IS NULL
   OR (
      image_embedding_local_port = 11434
      AND COALESCE(NULLIF(TRIM(image_embedding_local_host), ''), '') = ''
      AND COALESCE(image_embedding_provider_mode, 'disabled') = 'disabled'
   );
