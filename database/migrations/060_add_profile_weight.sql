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

-- Migration: 060_add_profile_weight.sql
-- Purpose: Add profile_weight column to library_policies table
-- Date: 2026-01-15
-- Related: PolicyEngine uses profile_weight but column was missing from schema

-- Add profile_weight column to library_policies
-- This weight controls how much the library statistical profile influences classification decisions
-- Default 0.25 (25%) matches the PolicyEngine default
-- Using NOT NULL DEFAULT ensures new and existing rows automatically get the default value
ALTER TABLE library_policies 
ADD COLUMN IF NOT EXISTS profile_weight REAL NOT NULL DEFAULT 0.25;
