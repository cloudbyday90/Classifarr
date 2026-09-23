/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildInventoryTmdbObservation } from '../../services/inventoryTmdbObservation.mjs';

export const companyFixtureTime = '2026-09-22T12:00:00.000Z';
export function inventoryCompanyFixture(perLibrary = 60) {
  const libraries = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, media_type: i < 3 ? 'movie' : 'tv' }));
  const rows = libraries.flatMap(library => Array.from({ length: perLibrary }, (_, i) => {
    const id = library.id * 1000 + i + 1;
    return { tmdb_id: id, library_id: library.id, media_type: library.media_type,
      overview: `Synthetic company benchmark description ${id}`, genres: ['Common genre'], studio: '', content_rating: '',
      company_checked_at: companyFixtureTime, company_observation: buildInventoryTmdbObservation({ id,
        production_companies: [{ id: 999, name: 'Shared producer' }, { id: library.id, name: `Producer ${library.id}` }],
        keywords: { [library.media_type === 'movie' ? 'keywords' : 'results']: [] },
      }, id, library.media_type, companyFixtureTime) };
  }));
  return { rows, libraries };
}
