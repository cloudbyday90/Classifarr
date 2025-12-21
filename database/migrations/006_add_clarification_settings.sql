-- Migration: Add AI Clarification Settings
-- These settings control the AI-driven clarification system

-- Add enable_clarification setting
INSERT INTO
    settings (key, value)
VALUES (
        'enable_clarification',
        'true'
    ) ON CONFLICT (key) DO NOTHING;

-- Add clarification_threshold setting (default 75%)
INSERT INTO
    settings (key, value)
VALUES (
        'clarification_threshold',
        '75'
    ) ON CONFLICT (key) DO NOTHING;