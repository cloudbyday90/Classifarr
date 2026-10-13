/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// PostgreSQL btrim defaults to ASCII space; identity readers use ECMAScript trim.
// Trusted constant SQL only: no identifier, value or expression from a request.
export const REQUEST_IDENTITY_WHITESPACE_SQL = [
  9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196,
  8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279,
].map(codePoint => `chr(${codePoint})`).join('||');
