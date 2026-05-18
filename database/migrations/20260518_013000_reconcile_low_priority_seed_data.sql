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

-- Reconcile lower-priority seed data that affects fresh-install semantic
-- parity with migrated installs but does not block core startup. These rows
-- historically lived inside mixed DDL+seed migrations and could be skipped
-- when bootstrap installs loaded database/schema/current.sql and marked the
-- historical migrations as already applied.
-- @seed-reconciliation snapshot-required

INSERT INTO settings (key, value)
VALUES ('rag_log_retention_days', '30')
ON CONFLICT (key) DO NOTHING;

INSERT INTO confidence_settings (
    setting_key,
    setting_value,
    description,
    default_value
)
VALUES
    ('policy_auto_classify_threshold', '85', 'Confidence % for auto-classification', '85'),
    ('policy_prompt_threshold', '60', 'Confidence % for user confirmation prompt', '60'),
    ('discord_auto_route_threshold', '85', 'Discord info-only message threshold', '85'),
    ('discord_verify_threshold', '60', 'Discord Yes/No verification threshold', '60'),
    ('discord_enhanced_details_threshold', '60', 'Discord detailed breakdown threshold', '60'),
    ('learning_genre_threshold', '3', 'Confirmations needed to learn genre preference', '3'),
    ('learning_keyword_threshold', '5', 'Confirmations needed to learn keyword preference', '5'),
    ('learning_studio_threshold', '2', 'Confirmations needed to learn studio preference', '2'),
    ('learning_min_confidence_rate', '75', 'Minimum % of confirms vs rejects', '75'),
    ('learning_conflict_strategy', 'escalate', 'Conflict resolution: block, escalate, auto_resolve', 'escalate'),
    ('learning_auto_resolve_threshold', '7', 'Confirmations to override exclusion', '7'),
    ('learning_multi_genre_strategy', 'weighted', 'Multi-genre learning: primary_only, weighted, all', 'weighted'),
    ('learning_max_per_user_day', '50', 'Max auto-learns per user per day', '50'),
    ('learning_max_per_library_hour', '20', 'Max auto-learns per library per hour', '20'),
    ('learning_lookback_days', '30', 'Days of feedback to consider', '30')
ON CONFLICT (setting_key) DO UPDATE
SET
    description = COALESCE(confidence_settings.description, EXCLUDED.description),
    default_value = COALESCE(confidence_settings.default_value, EXCLUDED.default_value);
