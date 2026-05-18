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

-- Reconcile bootstrap-sensitive seed data that originally lived inside older
-- mixed DDL+seed migrations. Fresh installs that bootstrap from
-- database/schema/current.sql mark those older migrations as already applied,
-- so any omitted seed rows must be restored forward-only here.

INSERT INTO ai_provider_config (
    id,
    primary_provider,
    heartbeat_timeout,
    heartbeat_interval,
    max_wait_time
)
VALUES (
    1,
    'none',
    30000,
    5000,
    60000
)
ON CONFLICT (id) DO UPDATE
SET
    primary_provider = COALESCE(ai_provider_config.primary_provider, EXCLUDED.primary_provider),
    heartbeat_timeout = COALESCE(ai_provider_config.heartbeat_timeout, EXCLUDED.heartbeat_timeout),
    heartbeat_interval = COALESCE(ai_provider_config.heartbeat_interval, EXCLUDED.heartbeat_interval),
    max_wait_time = COALESCE(ai_provider_config.max_wait_time, EXCLUDED.max_wait_time);

INSERT INTO pattern_analysis_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES
    ('classifarr_media_path', NULL),
    ('library_mapping_complete', 'false'),
    ('reclassification_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES
    ('log_retention_days', '30'),
    ('error_log_retention_days', '90'),
    ('log_level', 'INFO'),
    ('pattern_sync_frequency', 'daily'),
    ('profile_batch_size', '100'),
    ('profile_auto_generate', 'true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO confidence_settings (
    setting_key,
    setting_value,
    description,
    default_value
)
VALUES
    ('weight_source_library', '100', 'Source library signal weight', '100'),
    ('weight_manual_correction', '100', 'Manual correction signal weight', '100'),
    ('weight_existing_media', '100', 'Existing media signal weight', '100'),
    ('weight_exact_match', '100', 'Exact match signal weight', '100'),
    ('weight_event_detection', '30', 'Event detection signal weight', '30'),
    ('weight_custom_rule', '35', 'Custom rule signal weight', '35'),
    ('weight_collection_match', '25', 'Collection match signal weight', '25'),
    ('weight_learned_pattern', '20', 'Learned pattern signal weight', '20'),
    ('weight_content_analysis', '15', 'Content analysis signal weight', '15'),
    ('weight_keyword_match', '10', 'Keyword match signal weight', '10'),
    ('weight_genre_match', '10', 'Genre match signal weight', '10'),
    ('confidence_threshold', '80', 'Global confidence threshold', '80')
ON CONFLICT (setting_key) DO UPDATE
SET
    description = COALESCE(confidence_settings.description, EXCLUDED.description),
    default_value = COALESCE(confidence_settings.default_value, EXCLUDED.default_value);

INSERT INTO embedding_provider_availability (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
