/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Resume never enables a library or treats an absent lock as historical proof. */
export function legacyIngestionResumeReason({ library, source }, reviewReason) {
  if (library.archived_at) return 'library_archived';
  if (reviewReason !== 'disable_library') {
    return reviewReason === 'confirmation_required' ? 'library_disabled' : reviewReason;
  }
  if (!source || !['plex', 'jellyfin', 'emby'].includes(source.type)) return 'unsupported_source';
  if (source.is_active !== true) return 'source_disabled';
  if (source.configured !== true) return 'source_unconfigured';
  return 'confirmation_required';
}
