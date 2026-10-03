/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { releaseShutdownClaims } from '../services/queueShutdownClaimRelease.mjs';

const claim = id => ({ id, claim_token: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}` });

test('does not query without received claims or valid tokens', async () => {
  const db = { query: jest.fn() };
  await expect(releaseShutdownClaims(db, new Set())).resolves.toEqual({ released: [], failed: 0 });
  await expect(releaseShutdownClaims(db, [{ id: 1 }, { id: 2, claim_token: 'invalid' }]))
    .resolves.toEqual({ released: [], failed: 0 });
  expect(db.query).not.toHaveBeenCalled();
});

test('isolates rejected writes without retrying or treating stale claims as released', async () => {
  const db = { query: jest.fn().mockRejectedValueOnce(new Error('private connection detail'))
    .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 3 }] }) };
  await expect(releaseShutdownClaims(db, [claim(1), claim(2), claim(3)]))
    .resolves.toEqual({ released: [3], failed: 1 });
  expect(db.query).toHaveBeenCalledTimes(3);
  for (const [index, [sql, values]] of db.query.mock.calls.entries()) {
    expect(sql).toContain("status = 'processing' AND claim_token = $2::uuid");
    expect(values).toEqual([index + 1, claim(index + 1).claim_token, 'task_graceful_shutdown_recovered']);
  }
});

test('reports all failed writes without exposing their errors', async () => {
  const db = { query: jest.fn().mockRejectedValue(new Error('secret')) };
  await expect(releaseShutdownClaims(db, [claim(1), claim(2)]))
    .resolves.toEqual({ released: [], failed: 2 });
  expect(db.query).toHaveBeenCalledTimes(2);
});

test('snapshots tracked claims and releases sequentially while the live set changes', async () => {
  const first = claim(1), second = claim(2), claims = new Set([first, second]);
  let finishFirst;
  const db = { query: jest.fn().mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
    .mockResolvedValueOnce({ rows: [{ id: 2 }] }) };
  const release = releaseShutdownClaims(db, claims);
  expect(db.query).toHaveBeenCalledTimes(1);
  claims.delete(second); claims.add(claim(3));
  finishFirst({ rows: [{ id: 1 }] });
  await expect(release).resolves.toEqual({ released: [1, 2], failed: 0 });
  expect(db.query).toHaveBeenCalledTimes(2);
  expect([...claims]).toEqual([first, claim(3)]);
});
