-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- Migration: Reconcile missing clarification seed data
-- Purpose:
--   Fresh installs that bootstrap from database/schema/current.sql can mark
--   historical mixed migrations as already applied without replaying their
--   seed INSERT statements. This migration restores the default
--   confidence_thresholds rows and clarification_questions rows when they are
--   absent, without disturbing customized installs.
-- @seed-reconciliation snapshot-required

INSERT INTO confidence_thresholds (
  tier,
  min_confidence,
  max_confidence,
  action,
  description
)
VALUES
  (
    'auto',
    90,
    100,
    'auto_route',
    'Automatically route without interaction'
  ),
  (
    'verify',
    70,
    89,
    'verify_buttons',
    'Show Yes/No verification buttons'
  ),
  (
    'clarify',
    50,
    69,
    'clarify_questions',
    'Ask clarifying questions'
  ),
  (
    'manual',
    0,
    49,
    'manual_selection',
    'Request manual library selection'
  )
ON CONFLICT (tier) DO NOTHING;

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'Is this a stand-up comedy special?',
  'content_type',
  ARRAY['stand-up', 'comedy special', 'standup', 'live comedy'],
  ARRAY['Documentary', 'Comedy'],
  '{"yes": {"label": "Stand-Up Special", "confidence_boost": 30}, "no": {"label": "Regular Content", "confidence_boost": -10}}'::jsonb,
  10,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'Is this a stand-up comedy special?'
);

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'Is this a concert or live music performance?',
  'content_type',
  ARRAY['concert', 'live performance', 'tour', 'music festival'],
  ARRAY['Documentary', 'Music'],
  '{"yes": {"label": "Concert Film", "confidence_boost": 30}, "no": {"label": "Regular Content", "confidence_boost": -10}}'::jsonb,
  9,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'Is this a concert or live music performance?'
);

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'Is this an adult animated show (like South Park, Family Guy)?',
  'content_type',
  ARRAY['adult animation', 'adult cartoon', 'animated sitcom'],
  ARRAY['Animation', 'Comedy'],
  '{"yes": {"label": "Adult Animation", "confidence_boost": 30}, "no": {"label": "Family Animation", "confidence_boost": -10}}'::jsonb,
  8,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'Is this an adult animated show (like South Park, Family Guy)?'
);

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'Is this a reality competition show?',
  'content_type',
  ARRAY['reality', 'competition', 'contestants', 'elimination'],
  ARRAY['Reality', 'Documentary'],
  '{"yes": {"label": "Reality Competition", "confidence_boost": 30}, "no": {"label": "Regular Show", "confidence_boost": -10}}'::jsonb,
  7,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'Is this a reality competition show?'
);

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'What language is this content primarily in?',
  'language',
  ARRAY[]::text[],
  ARRAY[]::text[],
  '{"english": {"label": "English", "confidence_boost": 40}, "japanese": {"label": "Japanese", "confidence_boost": 40}, "korean": {"label": "Korean", "confidence_boost": 40}, "other": {"label": "Other Language", "confidence_boost": 0}}'::jsonb,
  5,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'What language is this content primarily in?'
);
