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

-- Migration: Add indexes to support scheduled security cleanup jobs
--
-- idx_refresh_tokens_expires_at: supports batch-delete of expired/revoked tokens
-- idx_api_key_audit_created_at: supports batch-delete of old audit rows by age
-- Both use IF NOT EXISTS for idempotency.

-- Index to support efficient expired token cleanup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
    ON public.refresh_tokens (expires_at);

-- Index to support efficient audit log pruning
CREATE INDEX IF NOT EXISTS idx_api_key_audit_created_at
    ON public.api_key_audit (created_at);
