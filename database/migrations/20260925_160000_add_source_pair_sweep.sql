-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS automatic_source_pair_sweep (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
    selection_offset integer NOT NULL DEFAULT 0 CHECK (selection_offset BETWEEN 0 AND 299),
    evidence_revision text CHECK (evidence_revision ~ '^[a-f0-9]{64}$')
);
COMMENT ON TABLE automatic_source_pair_sweep IS
    'Private bounded diagnostic coverage cursor. Independent of inference quota and unfinished capture. No routing authority or content.';
