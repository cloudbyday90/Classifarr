-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE provider_credential_probes (
    source TEXT NOT NULL CHECK (source IN ('omdb', 'web_search', 'legacy_tavily')),
    config_id INTEGER NOT NULL CHECK (config_id > 0),
    generation UUID NOT NULL,
    next_probe_at TIMESTAMPTZ NOT NULL,
    lease_token UUID,
    lease_until TIMESTAMPTZ,
    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures BETWEEN 0 AND 1000000),
    last_outcome TEXT CHECK (last_outcome IN ('verified', 'rejected', 'rate_limited',
        'quota_exhausted', 'invalid_response', 'unavailable', 'quota_wait')),
    last_probe_at TIMESTAMPTZ,
    last_recovered_at TIMESTAMPTZ,
    PRIMARY KEY (source, config_id),
    CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);

-- One bounded state row per saved configuration; no credentials or response bodies.
CREATE FUNCTION delete_provider_credential_probe() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    DELETE FROM public.provider_credential_probes WHERE source = TG_ARGV[0] AND config_id = OLD.id;
    RETURN OLD;
END;
$$;
CREATE TRIGGER omdb_credential_probe_delete AFTER DELETE ON omdb_config
    FOR EACH ROW EXECUTE FUNCTION delete_provider_credential_probe('omdb');
CREATE TRIGGER tavily_credential_probe_delete AFTER DELETE ON tavily_config
    FOR EACH ROW EXECUTE FUNCTION delete_provider_credential_probe('legacy_tavily');
CREATE TRIGGER web_search_credential_probe_delete AFTER DELETE ON web_search_provider_config
    FOR EACH ROW EXECUTE FUNCTION delete_provider_credential_probe('web_search');
