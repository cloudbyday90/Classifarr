-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS ollama_readiness_backfill_state (
    id integer PRIMARY KEY REFERENCES ai_provider_config(id) ON DELETE CASCADE CHECK (id = 1),
    configuration_revision bigint NOT NULL CHECK (configuration_revision >= 0),
    configuration_fingerprint text NOT NULL CHECK (configuration_fingerprint ~ '^[a-f0-9]{64}$'),
    status text NOT NULL CHECK (status IN ('waiting','checking','failed','completed')),
    reason text NOT NULL CHECK (reason IN ('waiting_for_configuration','waiting_for_libraries',
      'waiting_for_inventory','ingesting','backfilling','busy','database_capacity',
      'memory_pressure','memory_unknown','unavailable','readiness_backfill_unavailable',
      'checking','completed','stopped','configuration_changed')),
    observed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
COMMENT ON TABLE ollama_readiness_backfill_state IS
  'Single configuration-bound automatic capability observation; diagnostic only, never readiness or retry authority.';
