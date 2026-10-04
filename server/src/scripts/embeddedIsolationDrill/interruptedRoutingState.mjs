/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { routingCases } from './httpRoutingState.mjs';
import { validManualRoutingIntent } from '../../services/manualRoutingIntent.mjs';

export async function seedInterruptedRouting(db, hashPassword) {
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM libraries
    WHERE external_id IN ('isolation-interrupted-movie','isolation-interrupted-tv')`)).rows[0].n, 0);
  const password = `Fixture-${randomBytes(24).toString('hex')}!`;
  await db.query(`INSERT INTO users(username,password_hash,role,is_active,must_change_password)
    VALUES('interrupted-routing-admin',$1,'admin',true,false)`, [await hashPassword(password)]);
  const items = [];
  for (const item of routingCases) {
    const { rows: [library] } = await db.query(`INSERT INTO libraries
      (external_id,name,media_type,arr_type,arr_id,root_folder,quality_profile_id,radarr_settings,sonarr_settings)
      SELECT $1,'Interrupted ' || name,media_type,arr_type,arr_id,root_folder,quality_profile_id,radarr_settings,sonarr_settings
      FROM libraries WHERE external_id=$2 RETURNING id,arr_id`,
    [`isolation-interrupted-${item.type}`, `isolation-http-${item.type}`]);
    assert(library, 'missing_routing_fixture');
    // Only the two literal provider types from routingCases can supply this identifier.
    await db.query(`UPDATE ${item.arr}_config SET is_active=true WHERE id=$1`, [library.arr_id]);
    const { rows: [task] } = await db.query(`INSERT INTO task_queue
      (task_type,payload,status,source,next_retry_at,visible_at)
      VALUES('classification',$1,'pending','manual',NOW()+INTERVAL '1 day',NOW()+INTERVAL '1 day') RETURNING id::text`,
    [JSON.stringify({ media: { media_type: item.type, tmdb_id: item.tmdbId,
      tvdb_id: item.type === 'tv' ? 920002 : undefined, title: item.title, year: 2026 } })]);
    items.push({ type: item.type, taskId: task.id, libraryId: library.id });
  }
  // Captured privately by the parent, never written to a receipt or a log.
  return { password, items };
}

export async function readInterruptedRouting(db) {
  const { rows } = await db.query(`SELECT ch.id::text,ch.media_type,ch.method,ch.status,ch.library_id,ch.tmdb_id,
    ch.metadata->'classification_details' AS details,
    s.attempt_id::text,s.automatic_attempts,s.enabled,s.last_result,s.next_check_at::text,
    (SELECT count(*)::int FROM task_queue t WHERE t.source='manual' AND t.status='completed'
      AND (t.payload->'media'->>'tmdb_id')::int=ch.tmdb_id) AS completed_tasks
    FROM classification_history ch JOIN libraries l ON l.id=ch.library_id
    LEFT JOIN manual_routing_check_state s ON s.classification_id=ch.id
    WHERE l.external_id IN ('isolation-interrupted-movie','isolation-interrupted-tv')
    ORDER BY ch.media_type,ch.id LIMIT 3`);
  assert(rows.length <= 2, 'duplicate_interrupted_history');
  for (const row of rows) {
    assert.equal(row.method, 'manual_classification');
    assert.equal(row.status, 'completed');
    assert.equal(row.completed_tasks, 1);
    assert.equal(row.details.routing, 'manual_routing_pending');
    assert.match(row.details.manual_routing_attempt_id, /^[a-f0-9-]{36}$/);
    const intent = row.details.manual_routing_intent;
    assert(validManualRoutingIntent(intent), 'missing_committed_intent');
    assert.equal(intent.libraryId, row.library_id);
    assert.equal(intent.tmdbId, row.tmdb_id);
    assert.equal(intent.mediaType, row.media_type);
    assert(!JSON.stringify(row.details).includes('synthetic-routing'), 'credential_in_history');
  }
  return rows;
}

export async function disableInterruptedRouting(db) {
  for (const item of routingCases) {
    await db.query(`UPDATE ${item.arr}_config SET is_active=false
      WHERE id IN (SELECT arr_id FROM libraries WHERE external_id=$1)`, [`isolation-interrupted-${item.type}`]);
  }
  await db.query("UPDATE users SET is_active=false WHERE username='interrupted-routing-admin'");
}
