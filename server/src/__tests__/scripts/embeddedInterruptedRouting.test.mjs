/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { runInterruptedRoutingFixture, crashRoutingRuntime } from '../../scripts/embeddedIsolationDrill/interruptedRoutingFixture.mjs';
import { startRoutingProvider, fixtureRequest } from '../../scripts/embeddedIsolationDrill/httpRoutingTransport.mjs';
import { seedInterruptedRouting, readInterruptedRouting } from '../../scripts/embeddedIsolationDrill/interruptedRoutingState.mjs';

test('data probe guards the environment and mounts before loading application dependencies', async () => {
  const source = await readFile(new URL('../../scripts/embeddedIsolationDrill/interruptedRoutingDataProbe.mjs', import.meta.url), 'utf8');
  const loaded = source.indexOf("await " + "import('./interruptedRoutingState.mjs')");
  expect(source).not.toMatch(/^import .* from ['"].*interruptedRoutingState/m);
  expect(loaded).toBeGreaterThan(source.indexOf('assertProbeEnvironment(process.env'));
  expect(loaded).toBeGreaterThan(source.indexOf("assertContainerLayout(await readFile('/proc/self/mountinfo'"));
});

function harness(fault) {
  const counts = { tmdb: 0, movieReads: 0, tvReads: 0, movieAdds: 0, tvAdds: 0, healthReads: 0, unexpected: 0 };
  const items = [{ type: 'movie', taskId: '1', libraryId: 11 }, { type: 'tv', taskId: '2', libraryId: 12 }];
  let rows = [], hold, rejectRequest, starts = 0;
  const close = jest.fn(), stop = jest.fn(), events = [];
  const data = jest.fn(async mode => {
    if (mode === 'seed') return { password: 'synthetic', items };
    if (mode === 'disable') { events.push('disable'); return; }
    return JSON.parse(JSON.stringify(rows));
  });
  const request = jest.fn(async (path) => {
    if (path === '/api/auth/login') return { status: 200, cookies: ['access_token=x', 'classifarr_csrf_token=y'] };
    if (path.includes('/tasks/')) {
      const item = items.find(value => path.includes(`/${value.taskId}/`));
      if (rows.some(row => row.media_type === item.type)) {
        if (fault === 'replay') counts[`${item.type}Adds`]++;
        return { status: 409 };
      }
      rows.push({ id: item.taskId, media_type: item.type, details: { routing: 'manual_routing_pending', manual_routing_attempt_id: 'attempt' } });
      counts[`${item.type}Reads`]++; counts[`${item.type}Adds`]++;
      const promise = new Promise((_, reject) => { rejectRequest = reject; });
      hold(item.type); return promise;
    }
    const row = rows.find(value => path.includes(`/${value.id}/`));
    if (row.details.manual_routing_observation) {
      if (fault === 'cooldown-read') counts[`${row.media_type}Reads`]++;
      return { status: 429, body: { reason: 'cooldown' } };
    }
    counts[`${row.media_type}Reads`]++;
    row.details.manual_routing_observation = { reason: 'verified_present' };
    if (fault === 'rewrite') row.details.routing = 'routed';
    Object.assign(row, { last_result: 'verified_present', attempt_id: 'attempt', automatic_attempts: 0, enabled: false });
    return { status: 200, body: { reason: 'verified_present', recorded: fault !== 'unrecorded' } };
  });
  return { counts, close, stop, data, events, request,
    providerFactory: async options => { hold = options.holdAfterAdd; return { counts, close }; },
    start: () => { starts++; counts.healthReads += 8; if (fault === 'restart' && starts === 2) rows = []; return { child: {} }; },
    ready: async () => {},
    crash: async () => { events.push('crash'); rejectRequest(new Error('connection_closed')); },
  };
}

test('accepted adds precede crash; restart verifies without replay and preserves cooldown', async () => {
  const deps = harness();
  await expect(runInterruptedRoutingFixture(deps)).resolves.toEqual({ interruptedAdds: 2, duplicateAdds: 0,
    verifiedObservations: 2, preservedCooldowns: 2 });
  expect(deps.events).toEqual(['crash', 'crash', 'disable']);
  expect(deps.close).toHaveBeenCalledTimes(1);
});

test.each(['replay', 'cooldown-read', 'rewrite', 'unrecorded', 'restart'])('%s fails closed and closes resources', async fault => {
  const deps = harness(fault);
  await expect(runInterruptedRoutingFixture(deps)).rejects.toThrow();
  expect(deps.stop).toHaveBeenCalled();
  expect(deps.close).toHaveBeenCalledTimes(1);
  expect(deps.events).not.toContain('disable');
});

test('startup and cleanup failures cannot report success', async () => {
  const deps = harness(); deps.ready = async () => { throw new Error('startup_failed'); };
  await expect(runInterruptedRoutingFixture(deps)).rejects.toThrow('startup_failed');
  expect(deps.close).toHaveBeenCalledTimes(1);
  const cleanup = harness(); cleanup.close.mockRejectedValue(new Error('cleanup_failed'));
  await expect(runInterruptedRoutingFixture(cleanup)).rejects.toThrow('cleanup_failed');
});

test('crash helper requires observed SIGKILL exit and a successfully sent signal', async () => {
  const child = { kill: jest.fn(() => true) };
  await crashRoutingRuntime({ child, done: Promise.resolve({ code: null, signal: 'SIGKILL' }) });
  expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  await expect(crashRoutingRuntime({ child, done: Promise.resolve({ code: 0, signal: null }) })).rejects.toThrow();
  child.kill.mockReturnValue(false);
  await expect(crashRoutingRuntime({ child })).rejects.toThrow('routing_crash_not_sent');
});

test('fixture endpoint rejects unapproved numeric paths before fetch', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  try {
    await expect(fixtureRequest('/api/admin/1/delete')).rejects.toThrow('fixture_http_path');
    await expect(fixtureRequest('/api/queue/tasks/0/classify')).rejects.toThrow('fixture_http_path');
    expect(fetch).not.toHaveBeenCalled();
  } finally { fetch.mockRestore(); }
});

test('seed rejects occupied fixture and observer rejects fabricated intent', async () => {
  const query = jest.fn(async () => ({ rows: [{ n: 1 }] }));
  await expect(seedInterruptedRouting({ query }, jest.fn())).rejects.toThrow();
  expect(query).toHaveBeenCalledTimes(1);
  query.mockResolvedValue({ rows: [{ method: 'manual_classification', status: 'completed', completed_tasks: 1,
    details: { routing: 'manual_routing_pending', manual_routing_attempt_id: '12345678-1234-1234-1234-123456789abc' } }] });
  await expect(readInterruptedRouting({ query })).rejects.toThrow('missing_committed_intent');
});

test('seed uses distinct library names and future queue eligibility without prebuilt intents', async () => {
  const query = jest.fn(async text => {
    if (text.startsWith('SELECT count')) return { rows: [{ n: 0 }] };
    if (text.startsWith('INSERT INTO libraries')) return { rows: [{ id: 11, arr_id: 1 }] };
    if (text.startsWith('INSERT INTO task_queue')) return { rows: [{ id: '20' }] };
    return { rows: [] };
  });
  const result = await seedInterruptedRouting({ query }, async () => 'hash');
  expect(result.items).toHaveLength(2);
  const sql = query.mock.calls.map(([text]) => text).join('\n');
  expect(sql).toContain("'Interrupted ' || name");
  expect(sql).toContain("NOW()+INTERVAL '1 day'");
  expect(sql).not.toContain('INSERT INTO classification_history');
});

test('held HTTP add stores provider effect but never acknowledges it', async () => {
  let accepted;
  const arrived = new Promise(resolve => { accepted = resolve; });
  const provider = await startRoutingProvider({ holdAfterAdd: accepted });
  const controller = new AbortController();
  const pending = fetch('http://127.0.0.1:21401/radarr/api/v3/movie', {
    method: 'POST', signal: controller.signal, headers: { 'x-api-key': 'synthetic-routing', 'content-type': 'application/json' },
    body: JSON.stringify({ tmdbId: 910001, qualityProfileId: 1, rootFolderPath: '/movies', addOptions: { searchForMovie: false } }),
  }).then(() => 'acknowledged', () => 'interrupted');
  try {
    expect(await arrived).toBe('movie');
    const response = await fetch('http://127.0.0.1:21401/radarr/api/v3/movie?tmdbId=910001', {
      headers: { 'x-api-key': 'synthetic-routing' }, signal: AbortSignal.timeout(2000),
    });
    expect(await response.json()).toEqual([{ id: 7, tmdbId: 910001, path: '/movies/Synthetic' }]);
    expect(provider.counts.movieAdds).toBe(1);
  } finally { controller.abort(); await provider.close(); }
  expect(await pending).toBe('interrupted');
});

test('startup health fixture allows only authenticated reads of three fixed endpoints', async () => {
  const provider = await startRoutingProvider({ healthChecks: true });
  const request = (path, method = 'GET') => fetch(`http://127.0.0.1:21401${path}`, {
    method, headers: { 'x-api-key': 'synthetic-routing' }, signal: AbortSignal.timeout(2000),
  });
  try {
    for (const type of ['radarr', 'sonarr']) {
      for (const path of ['system/status', 'qualityprofile', 'rootfolder']) {
        expect((await request(`/${type}/api/v3/${path}`)).status).toBe(200);
      }
    }
    expect((await request('/radarr/api/v3/system/status', 'POST')).status).toBe(400);
    expect(provider.counts).toMatchObject({ healthReads: 6, movieAdds: 0, tvAdds: 0, unexpected: 1 });
  } finally { await provider.close(); }
});
