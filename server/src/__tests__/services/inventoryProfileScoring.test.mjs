/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { learnInventoryProfiles, scoreInventoryProfile } from '../../services/inventoryLearnedProfiles.mjs';
import { scoreInventoryProfileFields, meanInventoryProfileFields } from '../../services/inventoryProfileScoring.mjs';

test('field extraction preserves the original smoothed fit, field order and unavailable semantics', () => {
  const libraries = [1, 2, 3, 4].map(id => ({ id, media_type: 'movie' }));
  const documents = libraries.flatMap(library => Array.from({ length: 40 }, (_, index) =>
    ({ key: `${library.id}:${index}`, hash: `${library.id}:${index}`, type: 'movie', libraryIds: [library.id] })));
  const metadata = new Map(documents.map(doc => [doc.key, { genres: ['common', `pattern-${doc.libraryIds[0]}`], studio: '', rating: '' }]));
  const model = learnInventoryProfiles(documents, metadata, libraries), query = { genres: ['common', 'pattern-4', 'pattern-4'] };
  const fields = scoreInventoryProfileFields(model, 4, query);
  expect(fields).toEqual({ genres: Math.log((41 / 42) / (1 / 122)) * (40 / 43) * (40 / 60), studio: null, rating: null });
  expect(scoreInventoryProfile(model, 4, query)).toBe(meanInventoryProfileFields(fields));
  for (const value of [null, {}, { genres: ['common'] }, { genres: ['unseen'] }]) {
    expect(scoreInventoryProfileFields(model, 1, value)).toEqual({ genres: null, studio: null, rating: null });
  }
  expect(scoreInventoryProfileFields(model, 99, query).genres).toBeNull();
  const alone = learnInventoryProfiles(documents, metadata, [libraries[0]]);
  expect(scoreInventoryProfileFields(alone, 1, query).genres).toBeNull();
  expect(meanInventoryProfileFields({ genres: 0, studio: null, rating: 2 })).toBe(1);
  expect(meanInventoryProfileFields({ genres: null, studio: null, rating: null })).toBe(0);
});
