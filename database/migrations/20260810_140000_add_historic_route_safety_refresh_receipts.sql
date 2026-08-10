-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- A controlled historic route-safety retry needs a bounded, durable operator
-- receipt. These tables intentionally retain only command and lifecycle IDs;
-- classification metadata, policy questions, provider content, and task
-- payloads remain outside the receipt projection.
CREATE TABLE IF NOT EXISTS policy_runtime_historic_route_safety_refresh_receipts (
    receipt_id uuid PRIMARY KEY,
    actor_id character varying(160) NOT NULL,
    requested_record_count smallint NOT NULL,
    receipt_version character varying(120) NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    execution_finalized_at timestamp with time zone,
    CONSTRAINT policy_runtime_historic_route_safety_refresh_receipts_requested_count_chk
      CHECK (requested_record_count BETWEEN 1 AND 50)
);

CREATE TABLE IF NOT EXISTS policy_runtime_historic_route_safety_refresh_receipt_items (
    receipt_id uuid NOT NULL REFERENCES policy_runtime_historic_route_safety_refresh_receipts(receipt_id) ON DELETE CASCADE,
    classification_id bigint NOT NULL,
    execution_status character varying(16) NOT NULL DEFAULT 'requested',
    reason_id character varying(120),
    retry_task_id bigint,
    queued_at timestamp with time zone,
    finalized_at timestamp with time zone,
    PRIMARY KEY (receipt_id, classification_id),
    CONSTRAINT policy_runtime_historic_route_safety_refresh_receipt_items_status_chk
      CHECK (execution_status IN ('requested', 'queued', 'skipped', 'failed')),
    CONSTRAINT policy_runtime_historic_route_safety_refresh_receipt_items_queue_chk
      CHECK (
        (execution_status = 'queued' AND retry_task_id IS NOT NULL AND queued_at IS NOT NULL)
        OR (execution_status <> 'queued' AND retry_task_id IS NULL AND queued_at IS NULL)
      )
);
