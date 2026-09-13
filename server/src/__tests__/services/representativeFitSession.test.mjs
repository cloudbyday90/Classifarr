/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { createRepresentativeFitSession } from '../../services/representativeFitSession.mjs';
import { fitRepresentativeGeometry } from '../../services/inventoryRepresentativeGeometry.mjs';
import { representativeFitFixture } from '../helpers/representativeFitFixture.mjs';

test.each([
  [1, '075f78d3f14048df8377d35dd4c28718920e8a4c6d6774d434ab9bbbe1f1b72f'],
  [2, '0a9a2e4f3dfcae68f3386e0f1ea9c280d5876bd0a17216f576a6e2a6815f156b'],
  [3, '39a95b005adf9774a8a1f6b10a5d6e6ea9160547443f8af28fa1182b346b3d79'],
  [123, 'b2278947a5dfba9c403b6a83613b3b2f93f15cc9caf534aed7f638c605725f04'],
])('retains pre-refactor fit output for synthetic seed %i', async (seed, digest) => {
  const result = await fitRepresentativeGeometry(representativeFitFixture(seed, 80, 4), { diagnostics: true });
  // Captured from 0e3e3ce0, rounded only to avoid platform floating-point tail differences.
  const serialized = JSON.stringify(result, (_key, value) => typeof value === 'number' ? Math.round(value * 1e12) / 1e12 : value);
  expect(createHash('sha256').update(serialized).digest('hex')).toBe(digest);
});

test('64 plus continuation matches one uninterrupted fit; returned diagnostics cannot mutate progress', async () => {
  const items = representativeFitFixture(), options = { diagnostics: true };
  const continued = createRepresentativeFitSession(items, options), uninterrupted = createRepresentativeFitSession(items, options);
  try {
    const initial = await continued.advance(64);
    expect(initial).toMatchObject({ iterations: 64, converged: false });
    initial.labels.fill(999); initial.groups[0].centroid.fill(999);
    const complete = await continued.advance(64);
    expect(complete).toMatchObject({ iterations: 65, converged: true });
    expect(complete).toEqual(await uninterrupted.advance(128));
    expect(await continued.advance(128)).toEqual(complete);
  } finally { continued.dispose(); uninterrupted.dispose(); }
});

test('small continuation chunks preserve the historical trajectory and completed fits', async () => {
  const items = representativeFitFixture(1, 80, 4), session = createRepresentativeFitSession(items, { diagnostics: true, firstIndex: 7 });
  try {
    await session.advance(1); await session.advance(3);
    const result = await session.advance(8);
    expect(result).toEqual(await fitRepresentativeGeometry(items, { diagnostics: true, firstIndex: 7 }));
    expect(result.converged).toBe(true);
    expect(await session.advance(64)).toEqual(result);
  } finally { session.dispose(); }
});

test('exhaustion never manufactures convergence or permits additional iterations', async () => {
  const session = createRepresentativeFitSession(representativeFitFixture(2, 8000, 16), { diagnostics: true });
  try {
    await session.advance(64);
    const exhausted = await session.advance(128);
    expect(exhausted).toMatchObject({ iterations: 128, converged: false });
    expect(await session.advance(128)).toEqual(exhausted);
  } finally { session.dispose(); }
}, 60_000);

test('rejects invalid limits, concurrent advancement and disposed sessions', async () => {
  const session = createRepresentativeFitSession(representativeFitFixture(1, 80, 4));
  for (const budget of [undefined, 0, -1, 129, NaN, 1.5, '64']) await expect(session.advance(budget)).rejects.toThrow('fit_options');
  const pending = session.advance(64);
  await expect(session.advance(1)).rejects.toThrow('fit_busy');
  expect((await pending).converged).toBe(true);
  session.dispose(); session.dispose();
  await expect(session.advance(1)).rejects.toThrow('fit_disposed');
});

test('cancellation during continuation discards state without a partial success', async () => {
  const controller = new AbortController();
  const session = createRepresentativeFitSession(representativeFitFixture(), { signal: controller.signal });
  await session.advance(64);
  const pending = session.advance(64); controller.abort();
  await expect(pending).rejects.toThrow();
  await expect(session.advance(1)).rejects.toThrow();
  session.dispose();
});

test('disposal during an in-flight seed rejects instead of returning a partial fit', async () => {
  const session = createRepresentativeFitSession(representativeFitFixture());
  const pending = session.advance(64); session.dispose();
  await expect(pending).rejects.toThrow('fit_disposed');
});
