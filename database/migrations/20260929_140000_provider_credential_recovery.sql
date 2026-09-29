-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE omdb_config ADD COLUMN credential_generation UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN credential_rejected_at TIMESTAMPTZ;
ALTER TABLE tavily_config ADD COLUMN credential_generation UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN credential_rejected_at TIMESTAMPTZ;
ALTER TABLE web_search_provider_config ADD COLUMN credential_generation UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN credential_rejected_at TIMESTAMPTZ;

CREATE FUNCTION reset_provider_credential_generation() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF TG_OP = 'INSERT' OR OLD.api_key IS DISTINCT FROM NEW.api_key
        OR (to_jsonb(OLD)->TG_ARGV[0]) IS DISTINCT FROM (to_jsonb(NEW)->TG_ARGV[0]) THEN
        NEW.credential_generation := gen_random_uuid();
        NEW.credential_rejected_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER omdb_credential_generation BEFORE INSERT OR UPDATE ON omdb_config
    FOR EACH ROW EXECUTE FUNCTION reset_provider_credential_generation('is_active');
CREATE TRIGGER tavily_credential_generation BEFORE INSERT OR UPDATE ON tavily_config
    FOR EACH ROW EXECUTE FUNCTION reset_provider_credential_generation('is_active');
CREATE TRIGGER web_search_credential_generation BEFORE INSERT OR UPDATE ON web_search_provider_config
    FOR EACH ROW EXECUTE FUNCTION reset_provider_credential_generation('is_enabled');

-- Secret-free projection of the same saved candidates used by provider admission.
CREATE VIEW enrichment_provider_credential_status AS
SELECT 'omdb'::text AS dependency, 'omdb'::text AS provider_key,
    credential_rejected_at IS NOT NULL AS credentials_rejected
FROM (SELECT * FROM omdb_config WHERE is_active = true ORDER BY id DESC LIMIT 1) selected
WHERE length(btrim(api_key)) > 0
UNION ALL
SELECT 'web_search', provider_key, credential_rejected_at IS NOT NULL
FROM web_search_provider_config WHERE is_enabled = true AND length(btrim(api_key)) > 0
UNION ALL
SELECT 'web_search', 'tavily', credential_rejected_at IS NOT NULL
FROM (SELECT * FROM tavily_config ORDER BY (is_active IS TRUE) DESC, id DESC LIMIT 1) legacy
WHERE is_active = true AND length(btrim(api_key)) > 0
    AND NOT EXISTS (SELECT 1 FROM web_search_provider_config WHERE provider_key = 'tavily');
