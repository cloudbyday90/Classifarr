/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ConflictError, ValidationError } from '../utils/appError.mjs';
import { reviewBody, reviewPreviewId } from './mediaIdentityReviewContract.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { createQueueMetadataCheckService } from './queueMetadataCheckService.mjs';
import { projectRepairReceipt, repairConflict, repairSourceVersion, repairTaskId } from './queueIdentityRepairContract.mjs';
import { lockRepairWrites, persistRepair, readRepairPreview, readRepairReceipt,
  readRepairTask, requireNoRepairEffects, storeRepairPreview } from './queueIdentityRepairRepository.mjs';
import { retryIdentityRepair } from './queueIdentityRepairRetry.mjs';

export function createQueueIdentityRepairService({ db, readProvider, deadlineMs = 10000 }) {
  const checker = createQueueMetadataCheckService({ db, readProvider, deadlineMs });
  let busy = false;
  async function admitted(actorId, action) {
    await requireReviewActor(db, actorId);
    if (busy) throw new ConflictError('Another identity review is running. Try again shortly.');
    busy = true;
    try { return await action(); }
    catch (error) {
      if (['55P03', '40P01', '57014'].includes(error?.code)) throw repairConflict();
      throw error;
    } finally { busy = false; }
  }
  async function evidence(actorId, taskId, signal) {
    signal?.throwIfAborted();
    if (await readRepairReceipt(db, taskId)) throw repairConflict();
    const task = await readRepairTask(db, taskId);
    const provider = await readProvider();
    const report = await checker.check(actorId, taskId, {}, signal);
    const match = report.identityEvidence;
    if (report.observation.category !== 'not_found' || match?.reason !== 'candidate_for_review' || !match.candidate) {
      throw new ConflictError('No verified replacement is available. Check the saved TMDb ID for details.',
        { code: 'queue_identity_repair_evidence_missing' });
    }
    return { task, provider, match };
  }
  async function finalTask(tx, actorId, taskId, version, providerRevision, newId, signal) {
    await requireReviewActor(tx, actorId, true);
    const task = await readRepairTask(tx, taskId);
    if (repairSourceVersion(task) !== version || (await readProvider(tx)).revision !== providerRevision) throw repairConflict();
    await requireNoRepairEffects(tx, taskId, task.media_type, Number(task.tmdb_id), newId);
    signal?.throwIfAborted();
    return task;
  }
  return {
    async receipt(actorId, rawId) {
      const taskId = repairTaskId(rawId);
      // Local durable state only. Lock actor so revocation cannot race this read.
      return db.withTransaction(async tx => {
        await requireReviewActor(tx, actorId, true);
        return { receipt: projectRepairReceipt(await readRepairReceipt(tx, taskId)) };
      });
    },
    async preview(actorId, rawId, body, signal) {
      const taskId = repairTaskId(rawId); reviewBody(body, []);
      return admitted(actorId, async () => {
        const { task, provider, match } = await evidence(actorId, taskId, signal);
        const version = repairSourceVersion(task);
        return db.withTransaction(async tx => {
          await lockRepairWrites(tx);
          await finalTask(tx, actorId, taskId, version, provider.revision, match.candidate.tmdbId, signal);
          if (await readRepairReceipt(tx, taskId)) throw repairConflict();
          const id = randomUUID();
          const expiresAt = await storeRepairPreview(tx, { actorId, id, taskId, version,
            providerRevision: provider.revision, candidate: match.candidate, sources: match.sources });
          signal?.throwIfAborted();
          return { previewId: id, taskId, oldTmdbId: Number(task.tmdb_id), mediaType: task.media_type,
            candidate: match.candidate, sources: match.sources, expiresAt };
        });
      });
    },
    async confirm(actorId, rawId, body, signal) {
      const taskId = repairTaskId(rawId); reviewBody(body, ['previewId', 'sameWorkAndEdition']);
      const id = reviewPreviewId(body.previewId);
      if (body.sameWorkAndEdition !== true) throw new ValidationError('Confirm the same work and edition');
      return admitted(actorId, async () => {
        const existing = await readRepairReceipt(db, taskId);
        if (existing) {
          if (existing.id !== id || existing.actor_id !== actorId) throw repairConflict();
          return { receipt: projectRepairReceipt(existing) };
        }
        const preview = await readRepairPreview(db, actorId, taskId, id);
        const before = await readRepairTask(db, taskId);
        if (repairSourceVersion(before) !== preview.source_version ||
            (await readProvider()).revision !== preview.provider_revision) throw repairConflict();
        const { task, provider, match } = await evidence(actorId, taskId, signal);
        if (repairSourceVersion(task) !== preview.source_version || provider.revision !== preview.provider_revision ||
            !isDeepStrictEqual(match.candidate, preview.candidate) || !isDeepStrictEqual(match.sources, preview.sources)) throw repairConflict();
        return db.withTransaction(async tx => {
          await lockRepairWrites(tx);
          await requireReviewActor(tx, actorId, true);
          const committed = await readRepairReceipt(tx, taskId);
          if (committed?.id === id && committed.actor_id === actorId) return { receipt: projectRepairReceipt(committed) };
          if (committed) throw repairConflict();
          const current = await finalTask(tx, actorId, taskId, preview.source_version,
            preview.provider_revision, preview.candidate.tmdbId, signal);
          const currentPreview = await readRepairPreview(tx, actorId, taskId, id);
          const receipt = await persistRepair(tx, actorId, current, currentPreview);
          signal?.throwIfAborted();
          return { receipt: projectRepairReceipt(receipt) };
        });
      });
    },
    async retry(actorId, rawId, body, signal) {
      const taskId = repairTaskId(rawId); reviewBody(body, ['receiptId']);
      const id = reviewPreviewId(body.receiptId);
      return admitted(actorId, async () => ({ receipt: await retryIdentityRepair(db, actorId, taskId, id, signal) }));
    },
  };
}
