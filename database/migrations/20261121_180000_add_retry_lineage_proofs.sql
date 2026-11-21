-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0

CREATE TABLE classification_retry_lineage_proofs (
    task_id bigint PRIMARY KEY REFERENCES task_queue(id) ON DELETE CASCADE,
    source_classification_id bigint NOT NULL CHECK (source_classification_id > 0),
    evidence jsonb NOT NULL CHECK (octet_length(evidence::text) <= 65536),
    replacement_classification_id bigint CHECK (replacement_classification_id > 0),
    completed_claim_token uuid,
    CHECK ((replacement_classification_id IS NULL) = (completed_claim_token IS NULL))
);

CREATE INDEX idx_media_requests_retry_lineage
    ON media_requests (classification_id, id) WHERE classification_id IS NOT NULL;
CREATE INDEX idx_webhook_log_retry_lineage
    ON webhook_log (classification_id, id) WHERE classification_id IS NOT NULL;
