-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE media_server ADD COLUMN catalog_revision BIGINT NOT NULL DEFAULT 1 CHECK (catalog_revision > 0);

CREATE FUNCTION advance_media_server_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.catalog_revision := OLD.catalog_revision + CASE WHEN
    ROW(NEW.type, NEW.url, NEW.api_key, NEW.is_active) IS DISTINCT FROM
    ROW(OLD.type, OLD.url, OLD.api_key, OLD.is_active) THEN 1 ELSE 0 END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER media_server_catalog_revision BEFORE UPDATE ON media_server
  FOR EACH ROW EXECUTE FUNCTION advance_media_server_catalog_revision();

CREATE TABLE media_server_catalog_status (
  media_server_id INTEGER PRIMARY KEY REFERENCES media_server(id) ON DELETE CASCADE,
  source_revision BIGINT NOT NULL CHECK (source_revision > 0),
  attempt_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  reason TEXT NOT NULL CHECK (reason IN ('checking','complete','authentication','forbidden','rate_limited',
    'unreachable','timeout','invalid_catalog','endpoint_unavailable','cancelled','response_too_large',
    'provider_unavailable','configuration_changed','local_update_failed','unknown')),
  contract TEXT NOT NULL CHECK (contract IN ('unknown','plex_sections','emby_query','emby_legacy','jellyfin_virtual_folders')),
  http_status SMALLINT CHECK (http_status BETWEEN 100 AND 599),
  last_success_at TIMESTAMPTZ,
  last_success_count INTEGER CHECK (last_success_count BETWEEN 0 AND 1000),
  CHECK ((reason = 'checking') = (finished_at IS NULL)),
  CHECK ((last_success_at IS NULL) = (last_success_count IS NULL))
);
