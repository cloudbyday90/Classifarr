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

-- Add quality_profile_id and minimum_availability to radarr_config
ALTER TABLE radarr_config
ADD COLUMN quality_profile_id INTEGER,
ADD COLUMN minimum_availability VARCHAR(50) DEFAULT 'released';

-- Add quality_profile_id and series_type/monitor to sonarr_config
-- Note: Sonarr uses "monitor" (all, future, missing, etc) and "series_type" (standard, daily, anime)
-- User asked for "availability" but for Sonarr that conceptually maps to Monitor/Type usually?
-- Wait, User specifically asked "For Sonarr and Radarr I thought we can set the availability and the quality?"
-- Sonarr DOES NOT have "Minimum Availability". It has "Monitor" (e.g. all, future) and "Series Type".
-- However, I will check if Sonarr API has something similar or if the user is conflating them.
-- Checking Sonarr docs/implementation: Sonarr series have "monitored" (bool) and "addOptions" which has "monitor" (all, future, etc)
-- Radarr has "minimumAvailability".
-- I will add 'monitor' and 'series_type' for Sonarr as they are the equivalents.
-- Actually, let's stick to what allows "Availability" if possible, but for Sonarr it's likely "Series Type" or "Monitor".
-- I'll check what standard *arr clients do.
-- For now, I'll add quality_profile_id to both.
-- I will add 'minimum_availability' to Radarr.
-- For Sonarr, I will add 'monitor' and 'series_type' as these are standard.

ALTER TABLE sonarr_config
ADD COLUMN quality_profile_id INTEGER,
ADD COLUMN monitor VARCHAR(50) DEFAULT 'all',
ADD COLUMN series_type VARCHAR(50) DEFAULT 'standard';