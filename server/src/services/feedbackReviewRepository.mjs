/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { ForbiddenError } from '../utils/appError.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { feedbackReviewChanged, feedbackReviewHash } from './feedbackReviewContract.mjs';
import { pruneFeedbackReviewReferences } from './feedbackReviewMaintenance.mjs';

export async function requireFeedbackReviewActor(client, actorId, lock = false) {
  if (typeof actorId !== 'number' || !positiveDatabaseInteger(actorId)) throw new ForbiddenError('An active administrator account is required');
  const row = (await client.query(`SELECT role,is_active,created_at::text AS actor_created_at FROM users WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [actorId])).rows[0]; // sql-interpolation: fixed boolean lock clause; actor is bound
  if (row?.role !== 'admin' || row.is_active !== true || typeof row.actor_created_at !== 'string' ||
      !Number.isFinite(Date.parse(row.actor_created_at))) throw new ForbiddenError('An active administrator account with a stable identity is required');
  return { id: actorId, key: feedbackReviewHash(['feedback.review.actor.v1', actorId, row.actor_created_at]) };
}
export async function readFeedbackReviewSource(client, id, lock = false) {
  return (await client.query(`SELECT id,tmdb_id,media_type,title,metadata,confidence,status,method,library_name,
    xmin::text AS review_revision,created_at AT TIME ZONE 'UTC' AS created_at
    FROM classification_history WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0]; // sql-interpolation: fixed boolean lock clause; ID is bound
}
export async function readFeedbackReviewChoices(client, mediaType) {
  return (await client.query(`SELECT lp.id AS policy_id,lp.name AS policy_name,lp.xmin::text AS policy_revision,
    l.id AS library_id,l.name AS library_name,l.xmin::text AS library_revision
    FROM library_policies lp JOIN libraries l ON l.id=lp.library_id
    WHERE l.is_active=true AND l.media_type=$1 ORDER BY l.id,lp.id LIMIT 129`, [mediaType])).rows;
}
export async function storeFeedbackReview(client, actorId, classificationId, projection) {
  // All preparation writers share this short cap lock; no lock is held over UI review.
  await client.query('SELECT pg_advisory_xact_lock(1179796822)');
  await pruneFeedbackReviewReferences(client);
  await client.query('DELETE FROM feedback_review_references WHERE actor_id=$1 AND classification_id=$2', [actorId, classificationId]);
  const budget = (await client.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE actor_id=$1)::int AS owned
    FROM feedback_review_references`, [actorId])).rows[0];
  if (budget.total >= 100 || budget.owned >= 10) throw feedbackReviewChanged();
  return (await client.query(`INSERT INTO feedback_review_references(id,actor_id,classification_id,projection)
    VALUES($1,$2,$3,$4) RETURNING *`, [randomUUID(), actorId, classificationId, projection])).rows[0];
}
export async function readFeedbackReview(client, actorId, classId, reviewId, lock = false) {
  return (await client.query(`SELECT * FROM feedback_review_references WHERE actor_id=$1 AND classification_id=$2 AND id=$3${lock ? ' FOR UPDATE' : ''}`, // sql-interpolation: fixed boolean lock clause; values are bound
  [actorId, classId, reviewId])).rows[0];
}
