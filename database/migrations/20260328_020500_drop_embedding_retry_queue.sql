-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Migration: 20260328_020500_drop_embedding_retry_queue.sql
--
-- PURPOSE
-- Removes the legacy embedding_retry_queue table after the embedding runtime
-- was consolidated onto the canonical "missing embedding" work queries plus
-- shared provider-availability cooldown state.
--
-- SAFETY — EXISTING INSTALLS
-- The table is no longer used by the live embedding path. DROP TABLE IF EXISTS
-- makes this migration safe to apply even if a prior install never created the
-- table or it was manually removed.
--
-- SAFETY — FRESH INSTALLS
-- Fresh installs may still create the table from older schema snapshots or
-- earlier migrations before this migration runs. This migration removes it so
-- the final schema matches the current runtime.

DROP TABLE IF EXISTS embedding_retry_queue;
