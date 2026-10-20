/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { studyPadding,failedHistoryEvidence } from './studyHistory.mjs';

export async function seedPressureHistory(client,manifest) {
  const ids=(await client.query("SELECT id FROM gateway_archive.job WHERE status='failed' ORDER BY id LIMIT 3001")).rows.map(row=>row.id);
  assert.equal(ids.length,3000);const hash=createHash('sha256');
  for (let offset=0;offset<ids.length;offset+=16) {
    const batch=ids.slice(offset,offset+16),padding=batch.map((_,index)=>studyPadding(offset+index));
    padding.forEach(value=>hash.update(value));
    await client.query(`UPDATE gateway_archive.job j SET manifest=$3::jsonb||jsonb_build_object('archiveId',j.id,'revision',j.revision,
      'fixturePadding',p.padding),manifest_sha256=repeat('f',64) FROM unnest($1::uuid[],$2::text[]) AS p(id,padding) WHERE j.id=p.id`,[batch,padding,manifest]);
  }
  const evidence=await failedHistoryEvidence(client);
  assert.ok(evidence.bytes>220000000 && evidence.bytes<268435456);
  assert.ok(evidence.storage.toast_bytes>evidence.bytes*0.45,'pressure_history_storage_not_varied');
  return {...evidence,shape:{version:1,rows:3000,paddingBytes:75000,payloadSha256:hash.digest('hex')}};
}
