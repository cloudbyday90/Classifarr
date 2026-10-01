-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Bounded, restart-safe admission only; no media, credentials or arbitrary SQL.
CREATE TABLE queue_vacuum_recovery_state (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    statistics_epoch varchar(200),
    vacuum_progress varchar(100),
    pressure_since timestamptz,
    observed_at timestamptz,
    next_attempt_at timestamptz,
    attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    last_result varchar(64) NOT NULL DEFAULT 'unobserved'
);
INSERT INTO queue_vacuum_recovery_state (singleton) VALUES (true);
