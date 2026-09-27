/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { AppError, ValidationError } from '../utils/appError.mjs';
import { reviewBody, reviewInteger, reviewPreviewId } from './mediaIdentityReviewContract.mjs';
import { catalogSourceVersion } from './libraryCatalogContext.mjs';

export function archiveRequest(actorId, libraryId, body, revision) {
  reviewBody(body, ['requestId', 'operation', 'workersStopped']);
  if (!['archive', 'restore'].includes(body.operation) || body.workersStopped !== true) {
    throw new ValidationError('Confirm the operation and that older/external writers are stopped');
  }
  if (revision === undefined) throw new AppError('Refresh the archive review first', 428);
  if (typeof revision !== 'string' || !/^"[a-f0-9]{64}"$/.test(revision)) throw new ValidationError('An exact archive review revision is required');
  return { actorId: reviewInteger(actorId), libraryId: reviewInteger(libraryId),
    requestId: reviewPreviewId(body.requestId), operation: body.operation, revision };
}

export function projectLibraryArchive(snapshot, context, actorId) {
  const { library, syncs, capture, activeOwner, ownership, itemCount } = snapshot;
  const operation = library.archived_at ? 'restore' : 'archive';
  const visible = context?.catalog.some(row => row.external_id === library.external_id);
  const reason = activeOwner ? 'active_owner' : syncs.length || capture || ownership?.phase === 'running' ? 'unfinished_import'
    : library.is_active ? 'disable_library' : operation === 'archive' && visible ? 'still_visible' : 'ready';
  const revision = `"${createHash('sha256').update(JSON.stringify([1, actorId, snapshot,
    context ? catalogSourceVersion(context.source) : null, context?.catalog.slice().sort((a, b) => a.external_id.localeCompare(b.external_id))])).digest('hex')}"`;
  return { version: 1, revision, operation, reason, canConfirm: reason === 'ready',
    library: { id: library.id, name: library.name, archived: Boolean(library.archived_at), enabled: library.is_active },
    itemCount, effect: operation === 'archive'
      ? 'Archive locally; preserve inventory, policies, mappings and history. No media files are changed.'
      : 'Remove the archive marker; keep this library disabled. Enable separately after reviewing its source.' };
}
