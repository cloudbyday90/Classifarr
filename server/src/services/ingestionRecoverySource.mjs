/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Fixed aliases only; never project the fingerprint or its configuration inputs.
// Enable/disable pauses work without changing its source identity.
export const RECOVERY_SOURCE_FINGERPRINT_SQL = `encode(sha256(convert_to(jsonb_build_array(ms.type,ms.url,ms.api_key)::text,'UTF8')),'hex')`;
export const RECOVERY_SOURCE_MATCH_SQL = `(r.source_id=ms.id AND r.source_fingerprint=${RECOVERY_SOURCE_FINGERPRINT_SQL}
  AND r.source_external_id=l.external_id AND r.source_media_type=l.media_type)`;
