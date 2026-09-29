/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { httpGet, httpPost } from '../utils/httpClient.mjs';
import { classifyOmdbResponse } from './omdbResponseClassifier.mjs';
import { providerProbeRetryHint } from './providerRecoveryProbePolicy.mjs';
import { webSearchPacingDelay } from './webSearchPacingPolicy.mjs';

const QUERY = 'Classifarr provider connectivity test';
const options = Object.freeze({ timeout: 5000, maxResponseBytes: 65536, redirect: 'error' });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const results = (value, urlKey = 'url') => Array.isArray(value) && value.length <= 20 && value.every(item =>
  record(item) && typeof item.title === 'string' && item.title.length > 0 &&
  typeof item[urlKey] === 'string' && /^https?:\/\//.test(item[urlKey]));

function classify(provider, response) {
  const { status, data } = response ?? {};
  if (status >= 500 || status === 408) return 'unavailable';
  if (provider === 'omdb') {
    const { kind } = classifyOmdbResponse(data, status ?? 0);
    if (kind === 'success' && data.imdbID === 'tt0133093') return 'verified';
    if (kind === 'authentication' || kind === 'access_denied') return 'rejected';
    return ['rate_limited', 'quota_exhausted'].includes(kind) ? kind : 'invalid_response';
  }
  if (status === 401 || status === 403) return 'rejected';
  if (status === 429) return 'rate_limited';
  if ([402, 432, 433].includes(status)) return 'quota_exhausted';
  if (status !== 200 || !record(data) || data.error != null || data.message != null) return 'invalid_response';
  if (provider === 'tavily' && data.query === QUERY && results(data.results)) return 'verified';
  if (provider === 'brave' && data.type === 'search' && data.query?.original === QUERY && results(data.web?.results)) return 'verified';
  if (provider === 'serper' && data.searchParameters?.q === QUERY && results(data.organic, 'link')) return 'verified';
  return 'invalid_response';
}

/** No caching, redirects, retries, private media titles or upstream text in outcomes. */
export async function verifyProviderRecovery(claim, { get = httpGet, post = httpPost } = {}) {
  const provider = claim?.provider_key, key = claim?.config?.api_key;
  if (typeof key !== 'string' || !key.trim()) return { category: 'unavailable' };
  try {
    let response;
    if (provider === 'omdb') response = await get('https://www.omdbapi.com/', {
      ...options, params: { apikey: key, i: 'tt0133093', plot: 'short', r: 'json' },
    });
    else if (provider === 'tavily') response = await post('https://api.tavily.com/search', {
      query: QUERY, search_depth: 'basic', max_results: 1, include_answer: false, include_raw_content: false,
    }, { ...options, headers: { Authorization: `Bearer ${key}`,
      ...(claim.config.config?.projectId ? { 'X-Project-ID': String(claim.config.config.projectId) } : {}) } });
    else if (provider === 'brave') response = await get('https://api.search.brave.com/res/v1/web/search', {
      ...options, params: { q: QUERY, count: 1, safesearch: 'strict' }, headers: { 'X-Subscription-Token': key },
    });
    else if (provider === 'serper') response = await post('https://google.serper.dev/search', {
      q: QUERY, num: 1, autocorrect: false,
    }, { ...options, headers: { 'X-API-KEY': key } });
    else return { category: 'unavailable' };
    return { category: classify(provider, response), retryAfterMs: provider === 'omdb'
      ? providerProbeRetryHint(response) : 1000 * webSearchPacingDelay(provider, response) };
  } catch (error) {
    return { category: error?.response ? classify(provider, error.response) : 'unavailable',
      retryAfterMs: provider === 'omdb' ? providerProbeRetryHint(error?.response)
        : 1000 * webSearchPacingDelay(provider, error?.response) };
  }
}
