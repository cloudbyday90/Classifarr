/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { rememberProviderRequest, providerRequestEvidence, inheritProviderRequests } from '../services/providerRequestEvidence.mjs';
const context = { source: 'omdb', id: 1, generation: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', providerKey: 'omdb' };

test('request provenance is canonical, immutable and not serialized with errors', () => {
  const error = rememberProviderRequest(new Error('synthetic'), [{ ...context, apiKey: 'must-not-survive' }]);
  const evidence = providerRequestEvidence(error);
  expect(evidence).toEqual([{ ...context, generation: context.generation.toLowerCase() }]);
  expect(Object.isFrozen(evidence)).toBe(true);
  expect(Object.isFrozen(evidence[0])).toBe(true);
  expect(JSON.stringify(error)).toBe('{}');
  expect(providerRequestEvidence(JSON.parse(JSON.stringify(error)))).toBeNull();
});

test.each([null, [], Array(5).fill(context), [null], [{ ...context, id: -1 }],
  [{ ...context, generation: 'bad' }], [{ ...context, providerKey: 'brave' }],
  [{ ...context, providerKey: 'unknown' }], [{ ...context, source: 'legacy_tavily', providerKey: 'brave' }],
])('malformed or oversized evidence cannot authorize recovery: %p', contexts => {
  const target = {};
  expect(rememberProviderRequest(target, contexts)).toBe(target);
  expect(providerRequestEvidence(target)).toBeNull();
});
test('non-object targets are ignored', () => { expect(rememberProviderRequest(null, [context])).toBeNull(); });
test('all attempts must be known, and external fields cannot forge evidence', () => {
  const known = rememberProviderRequest({}, [context]);
  const other = rememberProviderRequest({}, [{ ...context, source: 'web_search', providerKey: 'brave' }]);
  expect(providerRequestEvidence(inheritProviderRequests({}, [known, other]))).toHaveLength(2);
  expect(providerRequestEvidence(inheritProviderRequests({}, [known, { credentialContext: context }]))).toBeNull();
  expect(providerRequestEvidence(inheritProviderRequests({}, []))).toBeNull();
});
