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

-- Preserve exhausted Tavily rows caused by monthly quota exhaustion.
-- Old behavior consumed attempts for status code 432 and left rows in a state
-- that was later auto-healed to failed. These should wait for next month reset.
UPDATE enrichment_retry_queue
SET status = 'skipped',
    reason = 'tavily_monthly_quota_deferred',
    completed_at = NOW(),
    error_message = 'Tavily monthly quota reached; deferred until next month reset'
WHERE enrichment_type = 'tavily'
  AND status = 'pending'
  AND attempts >= max_attempts
  AND (
    error_message ILIKE '%status code 432%'
    OR error_message ILIKE '%monthly quota%'
    OR error_message ILIKE '%quota reached%'
  );
