/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { parseCanonicalDatabaseInt32Id } from './databaseIntegerValues.mjs';

export function readSelectedClassificationLibraryId(library) {
  if (!library || typeof library !== 'object' || Array.isArray(library)) return null;
  return parseCanonicalDatabaseInt32Id(library.id ?? library.library_id);
}

export function holdInvalidSelectedClassificationLibrary(result) {
  if (result.library == null || readSelectedClassificationLibraryId(result.library) !== null) return result;

  return {
    ...result,
    library: null,
    needs_clarification: true,
    pending_reason: result.pending_reason || 'Selected library is invalid. Retry Classification to refresh the destination.',
  };
}
