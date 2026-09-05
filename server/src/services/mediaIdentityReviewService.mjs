/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ServiceUnavailableError, ValidationError } from '../utils/appError.mjs';
import { assertReviewSource, projectReviewCandidate, projectReviewSource, reviewBody, reviewInteger, reviewPreviewId } from './mediaIdentityReviewContract.mjs';
import { getMediaIdentityReceipt } from './mediaIdentityReceiptReadService.mjs';
import { applyReviewedIdentity, listReviewSources, readReviewSource, requireReviewActor, storeReviewPreview } from './mediaIdentityReviewRepository.mjs';

export function createMediaIdentityReviewService({ db, getIdentityDetails }) {
  return {
    getReceipt: (actorId, itemId, previewId) => getMediaIdentityReceipt(db, actorId, itemId, previewId),
    async list(actorId, query = {}) {
      await requireReviewActor(db, actorId);
      if (Object.keys(query).some(key => !['afterId', 'limit', 'mediaType'].includes(key))) {
        throw new ValidationError('Invalid review filter');
      }
      const afterId = query.afterId === undefined ? 0 : reviewInteger(query.afterId);
      const limit = query.limit === undefined ? 25 : reviewInteger(query.limit);
      const mediaType = query.mediaType ?? null;
      if (limit > 50 || (mediaType !== null && !['movie', 'tv'].includes(mediaType))) {
        throw new ValidationError('Invalid review filter');
      }
      return listReviewSources(db, { afterId, limit, mediaType });
    },

    async preview(actorId, rawItemId, body) {
      reviewBody(body, ['tmdbId', 'sourceVersion']);
      const itemId = reviewInteger(rawItemId);
      const tmdbId = reviewInteger(body.tmdbId);
      const version = body.sourceVersion;
      if (typeof version !== 'string' || !/^[a-f0-9]{64}$/.test(version)) throw new ValidationError('Invalid source version');
      await requireReviewActor(db, actorId);
      const source = await readReviewSource(db, itemId);
      assertReviewSource(source, version);
      let data;
      try {
        data = await getIdentityDetails(tmdbId, source.media_type);
      } catch (error) {
        if (error.response?.status === 404) throw new NotFoundError('TMDb has no item with this ID and media type');
        throw new ServiceUnavailableError('TMDb is unavailable. Try again later.', { code: 'review_provider_unavailable' });
      }
      const candidate = projectReviewCandidate(data, tmdbId, source.media_type);
      return db.withTransaction(async tx => {
        await requireReviewActor(tx, actorId, true);
        const current = await readReviewSource(tx, itemId, true);
        assertReviewSource(current, version);
        const id = randomUUID();
        const expiresAt = await storeReviewPreview(tx, { actorId, id, itemId, version, candidate });
        return { previewId: id, expiresAt, source: projectReviewSource(current), candidate };
      });
    },

    async confirm(actorId, rawItemId, body) {
      reviewBody(body, ['previewId', 'confirmed']);
      const itemId = reviewInteger(rawItemId);
      const previewId = reviewPreviewId(body.previewId);
      if (body.confirmed !== true) {
        throw new ValidationError('Explicit confirmation of a valid preview is required');
      }
      return db.withTransaction(async tx => {
        // Serializes this actor's preview lifecycle and prevents concurrent role revocation.
        await requireReviewActor(tx, actorId, true);
        // Keep source-before-preview order consistent with creation and source FK cascades.
        const source = await readReviewSource(tx, itemId, true);
        const { rows } = await tx.query(`SELECT * FROM media_identity_review_previews
          WHERE actor_id = $1 AND id = $2 AND item_id = $3 FOR UPDATE`, [actorId, previewId, itemId]);
        const preview = rows[0];
        if (!preview) throw new ConflictError('Preview is no longer available. Preview the item again.', { code: 'review_preview_unavailable' });
        assertReviewSource(source, preview.source_version);
        if (preview.candidate?.mediaType !== source.media_type) throw new ConflictError('Preview media type changed');
        reviewInteger(preview.candidate.tmdbId);
        const consumed = await tx.query(`DELETE FROM media_identity_review_previews
          WHERE actor_id = $1 AND id = $2 AND expires_at > clock_timestamp() RETURNING id`, [actorId, preview.id]);
        if (consumed.rowCount !== 1) throw new ConflictError('Preview expired. Preview the item again.', { code: 'review_preview_expired' });
        return applyReviewedIdentity(tx, { actorId, preview, source });
      });
    },
  };
}
