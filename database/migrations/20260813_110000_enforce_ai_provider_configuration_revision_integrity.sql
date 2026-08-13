-- Keep the singleton AI provider configuration revision safe for existing
-- installations. The preceding receipt migration introduces the column with
-- a zero baseline; this migration repairs only invalid stored values before
-- adding the durable invariant. Capability receipts are append-only and may
-- be cleared only by the existing replace-restore transaction-local permit;
-- neither schema rule retains provider or receipt contents.

UPDATE ai_provider_config
SET configuration_revision = 0
WHERE configuration_revision < 0;

ALTER TABLE ai_provider_config
    ALTER COLUMN configuration_revision SET DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ai_provider_config_revision_ck'
          AND conrelid = 'public.ai_provider_config'::regclass
    ) THEN
        ALTER TABLE ai_provider_config
            ADD CONSTRAINT ai_provider_config_revision_ck
            CHECK (configuration_revision >= 0) NOT VALID;
    END IF;
END $$;

ALTER TABLE ai_provider_config
    VALIDATE CONSTRAINT ai_provider_config_revision_ck;

CREATE OR REPLACE FUNCTION enforce_cbv_capability_receipts_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting(
           'classifarr.verification_capability_receipt_maintenance',
           true
       ) = 'replace_restore' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION
        'candidate-bound verification capability receipts are append-only'
        USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS cbv_capability_receipts_append_only
    ON candidate_bound_verification_capability_receipts;

CREATE TRIGGER cbv_capability_receipts_append_only
    BEFORE UPDATE OR DELETE ON candidate_bound_verification_capability_receipts
    FOR EACH ROW
    EXECUTE FUNCTION enforce_cbv_capability_receipts_append_only();
