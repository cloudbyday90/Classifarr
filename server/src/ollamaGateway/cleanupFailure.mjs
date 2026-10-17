/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const reasons = new Set(['gateway_cleanup_cooldown','gateway_cleanup_attempts_exhausted','gateway_cleanup_candidates_changed',
  'gateway_cleanup_archive_boundary','gateway_cleanup_source_changed','gateway_cleanup_identity_changed',
  'gateway_cleanup_role_unsafe','gateway_cleanup_worker_running','gateway_archive_protection_fence']);
const sqlReasons = new Map([['57014','gateway_cleanup_statement_timeout'],['55P03','gateway_cleanup_contended'],
  ['42501','gateway_cleanup_permission_denied']]);

/** Deliberately never return raw database errors, detail, SQL or arbitrary messages. */
export function cleanupFailureReason(error) {
  if (sqlReasons.has(error?.code)) return sqlReasons.get(error.code);
  if (reasons.has(error?.code)) return error.code;
  if (reasons.has(error?.message)) return error.message;
  return 'gateway_cleanup_unavailable';
}
