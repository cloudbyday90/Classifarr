/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Migration: Add require_all_confirmations setting
-- This setting allows users to request confirmation for all classifications,
-- regardless of confidence level

INSERT INTO settings (key, value) 
VALUES ('require_all_confirmations', 'false')
ON CONFLICT (key) DO NOTHING;
