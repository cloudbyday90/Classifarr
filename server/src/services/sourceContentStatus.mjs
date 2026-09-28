/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Fixed aliases: l = library; no configuration secrets or provider messages.
export const SOURCE_CONTENT_STATUS_SQL = `(SELECT jsonb_build_object('state',c.state,'reason',c.reason,
    'attempts',c.attempts,'retryAt',c.next_attempt_at)
  FROM media_source_content_circuits c JOIN media_server source ON source.id=c.media_server_id
  WHERE c.media_server_id=l.media_server_id AND c.source_revision=source.catalog_revision
    AND c.state<>'closed' AND source.is_active)`;
export const SOURCE_CONTENT_COOLING_SQL = `EXISTS (SELECT 1 FROM media_source_content_circuits c
  WHERE c.media_server_id=ms.id AND c.source_revision=ms.catalog_revision AND c.state<>'closed'
    AND (c.next_attempt_at IS NULL OR c.next_attempt_at>clock_timestamp()))`;
