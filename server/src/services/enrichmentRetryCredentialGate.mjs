/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Fixed SQL shared by atomic claims, dispatch and statistics; no caller input.
export const RETRY_CREDENTIALS_BLOCKED_SQL = `(
  enrichment_type IN ('omdb', 'web_search', 'tavily')
  AND EXISTS (SELECT 1 FROM enrichment_provider_credential_status credential
    WHERE credential.dependency = CASE WHEN enrichment_type = 'omdb' THEN 'omdb' ELSE 'web_search' END)
  AND NOT EXISTS (SELECT 1 FROM enrichment_provider_credential_status credential
    WHERE credential.dependency = CASE WHEN enrichment_type = 'omdb' THEN 'omdb' ELSE 'web_search' END
      AND NOT credential.credentials_rejected)
)`;
