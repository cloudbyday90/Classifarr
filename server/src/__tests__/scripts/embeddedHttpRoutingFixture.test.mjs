/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';

const request = jest.fn(), start = jest.fn(), seed = jest.fn(), read = jest.fn();
jest.unstable_mockModule('../../scripts/embeddedIsolationDrill/httpRoutingTransport.mjs', () => ({
  fixtureRequest: request, fixtureSession: response => response.body, startRoutingProvider: start,
}));
jest.unstable_mockModule('../../scripts/embeddedIsolationDrill/httpRoutingState.mjs', () => ({
  seedHttpRouting: seed, readHttpRouting: read,
  routingCases: [{ type: 'movie', tmdbId: 910001, title: 'Movie' }, { type: 'tv', tmdbId: 910002, title: 'TV' }],
}));
const { runHttpRoutingFixture } = await import('../../scripts/embeddedIsolationDrill/httpRoutingFixture.mjs');
let provider, database, tmdbService;
beforeEach(() => {
  jest.resetAllMocks();
  provider = { counts: { tmdb: 0, movieReads: 0, tvReads: 0, movieAdds: 0, tvAdds: 0, unexpected: 0 }, close: jest.fn() };
  start.mockResolvedValue(provider);
  read.mockResolvedValue([{}, {}]);
  database = { query: jest.fn(async () => ({ rows: [{ count: 2 }] })) };
  tmdbService = { baseUrl: 'original' };
  let classificationRequests = 0;
  request.mockImplementation(async (path, options) => {
    if (path === '/api/setup/create-admin') return { body: { cookie: 'admin', 'x-csrf-token': 'csrf' } };
    if (path === '/api/auth/login') return { body: { cookie: 'user' } };
    if (++classificationRequests <= 3) return { status: classificationRequests === 1 ? 401 : 403 };
    if (classificationRequests === 5) Object.assign(provider.counts,
      { tmdb: 5, movieReads: 2, tvReads: 2, movieAdds: 1, tvAdds: 1, unexpected: 0 });
    return { status: 200, body: { success: true, method: 'policy_auto', destination: { libraryName: options.body.title },
      routingOutcome: { shouldRoute: true, reason: 'policy_auto', routeResult: { attempted: true, routed: true, reason: 'routed' } } } };
  });
});
const run = () => runHttpRoutingFixture(database, { tmdbService, hashPassword: async () => 'synthetic-hash' });
const completion = () => database.query.mock.calls.filter(([sql]) => sql.includes('isolation_http_verified'));

test('only publishes completion after both routes, assertions and cleanup', async () => {
  await run();
  expect(request.mock.calls.filter(([path]) => path === '/api/classification/classify')).toHaveLength(5);
  expect(provider.close).toHaveBeenCalledTimes(1);
  expect(tmdbService.baseUrl).toBe('original');
  expect(completion()).toHaveLength(1);
  expect(database.query.mock.calls.at(-2)[0]).toBe('UPDATE tmdb_config SET is_active=false');
});

test.each(['auth', 'provider-on-denial', 'route', 'history', 'duplicate-add', 'cleanup'])('%s failure cannot publish completion or retry writes', async scenario => {
  const original = request.getMockImplementation();
  request.mockImplementation(async (...args) => {
    const response = await original(...args);
    if (args[0] === '/api/classification/classify') {
      if (scenario === 'auth' && response.status === 401) response.status = 200;
      if (scenario === 'provider-on-denial' && response.status === 401) provider.counts.tmdb++;
      if (scenario === 'route' && response.status === 200) response.body.routingOutcome.routeResult.routed = false;
      if (scenario === 'duplicate-add' && provider.counts.movieAdds) provider.counts.movieAdds++;
    }
    return response;
  });
  if (scenario === 'history') read.mockResolvedValue(null);
  if (scenario === 'cleanup') provider.close.mockRejectedValue(new Error('cleanup_failed'));
  await expect(run()).rejects.toThrow();
  expect(completion()).toHaveLength(0);
  expect(provider.close).toHaveBeenCalledTimes(1);
  expect(tmdbService.baseUrl).toBe('original');
  expect(request.mock.calls.filter(([, options]) => options.session?.cookie === 'admin' && options.body?.tmdb_id)).toHaveLength(
    ['auth', 'provider-on-denial'].includes(scenario) ? (scenario === 'auth' ? 0 : 1) : scenario === 'route' ? 2 : 3);
});
