/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { verifyTmdbRecoveryTitle } from '../services/tmdbRecoveryTitleVerification.mjs';

const item = { title: 'Fixture (US)', media_type: 'tv', year: 2001 };
const details = { id: 22, name: 'Fixture', original_name: 'Fixture', first_air_date: '2001-01-01' };
function run(response, source = item, row = details) {
  const service = { getIdentityAlternativeTitles: jest.fn().mockResolvedValue(response) };
  return { service, result: verifyTmdbRecoveryTitle(source, 22, row, service) };
}

test.each(['Fixture (US)', '  FIXTURE   (us) ', 'Fixture\t(US)'])('accepts only existing strict normalization: %s', async title => {
  expect(await run({ id: 22, results: [{ title }] }).result).toEqual({ tmdbId: 22 });
});
test('NFC and duplicate country aliases remain one candidate, not multiple identities', async () => {
  expect(await run({ id: 22, results: [{ title: 'Cafe\u0301' }, { title: 'Café' }] }, { ...item, title: 'Café' }).result)
    .toEqual({ tmdbId: 22 });
});
test('uses the movie response contract', async () => {
  expect(await run({ id: 22, titles: [{ title: item.title }] }, { ...item, media_type: 'movie' },
    { id: 22, title: 'Fixture', release_date: '2001-01-01' }).result).toEqual({ tmdbId: 22 });
});
test.each([null, {}, { id: 99, results: [] }, { id: 22, titles: [{ title: item.title }] },
  { id: 22, results: 'invalid' }, { id: 22, results: [{ title: item.title }, null] },
  { id: 22, results: [{ title: '' }] }, { id: 22, results: [{ title: 22 }] },
  { id: 22, results: [{ title: 'x'.repeat(501) }] }, { id: 22, results: Array(101).fill({ title: item.title }) }])
('rejects the entire malformed response: %j', async response => {
  expect(await run(response).result).toEqual({ tmdbId: null, reason: 'provider_response_invalid' });
});
test.each([[], [{ title: 'Fixture' }], [{ title: 'Fixture US' }], [{ title: 'Fixture (UK)' }]].map(results => [results]))
('does not infer identity from a near match: %j', async results => {
  expect(await run({ id: 22, results }).result).toEqual({ tmdbId: null, reason: 'title_year_mismatch' });
});
test('accepts the inclusive count and title-length bounds', async () => {
  const title = 'x'.repeat(500);
  expect(await run({ id: 22, results: Array(100).fill({ title }) }, { ...item, title }).result).toEqual({ tmdbId: 22 });
});
test.each([{ id: 99 }, { first_air_date: '2002-01-01' }, { first_air_date: '2001-02-29' },
  { first_air_date: null }, { media_type: 'movie' }, { name: null }, { original_name: '' }])
('invalid or mismatched details never fetch aliases: %j', async patch => {
  const t = run({ id: 22, results: [{ title: item.title }] }, item, { ...details, ...patch });
  expect((await t.result).tmdbId).toBeNull(); expect(t.service.getIdentityAlternativeTitles).not.toHaveBeenCalled();
});
test.each([{ title: '' }, { year: null }, { media_type: 'person' }])('invalid source never fetches aliases: %j', async patch => {
  const t = run(null, { ...item, ...patch });
  expect((await t.result).tmdbId).toBeNull(); expect(t.service.getIdentityAlternativeTitles).not.toHaveBeenCalled();
});
test('primary/original match avoids the additional request', async () => {
  const t = run(null, { ...item, title: 'Fixture' });
  expect(await t.result).toEqual({ tmdbId: 22 }); expect(t.service.getIdentityAlternativeTitles).not.toHaveBeenCalled();
});
