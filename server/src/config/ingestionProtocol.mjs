/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Compatibility signal, not a credential or a privilege boundary. Never a role/database default. */
export function ingestionConnectionOptions(options = '') {
  return `${options} -c classifarr.ingestion_protocol=1`.trim();
}
