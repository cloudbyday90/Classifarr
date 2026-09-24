/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateUpgradeCanaryProfiles } from '../scripts/libraryProfileUpgradeCanaryEvaluation.mjs';
import { CANARY_LIBRARIES } from '../scripts/libraryProfileUpgradeCanaryFixtures.mjs';

const libraryIds = Object.fromEntries(CANARY_LIBRARIES.map((library, index) => [library.key, index + 1]));
const genres = new Map(CANARY_LIBRARIES.map((library, index) => [index + 1, library.genre]));

function profileService(score = (libraryId, metadata) => metadata.genres.includes(genres.get(libraryId)) ? 65 : 50) {
    return {
        getProfileScoreDetails: async (libraryId, metadata) => ({ finalScore: score(libraryId, metadata) }),
    };
}

describe('synthetic upgrade profile canary', () => {
    test('reports same-media separation, ambiguity and the absent independent quality evidence separately', async () => {
        const result = await evaluateUpgradeCanaryProfiles({ profileService: profileService(), libraryIds });
        expect(result.byMedia).toEqual([
            { mediaType: 'movie', heldOutProbes: 4, separated: 4, ambiguousTies: 1 },
            { mediaType: 'tv', heldOutProbes: 4, separated: 4, ambiguousTies: 1 },
        ]);
        expect(result.heldOutProbes).toBe(8);
        expect(result.classificationQuality).toEqual({
            status: 'not_measured', independentlyCorrectedCases: 0,
            reasonId: 'independent_operator_corrections_unavailable_in_isolated_canary',
        });
        expect(result.automaticRoutingAuthorized).toBe(false);
    });

    test('fails when either media type loses expected separation', async () => {
        await expect(evaluateUpgradeCanaryProfiles({
            profileService: profileService((libraryId, metadata) =>
                metadata.media_type === 'tv' ? 50 : metadata.genres.includes(genres.get(libraryId)) ? 65 : 50),
            libraryIds,
        })).rejects.toThrow('Synthetic tv profile probe lost its expected separation');
    });

    test('fails when an unsupported winner appears on an ambiguous probe', async () => {
        await expect(evaluateUpgradeCanaryProfiles({
            profileService: profileService((libraryId, metadata) =>
                metadata.genres.length === 0 && libraryId === 1 ? 60 :
                    metadata.genres.includes(genres.get(libraryId)) ? 65 : 50),
            libraryIds,
        })).rejects.toThrow('Synthetic movie ambiguity probe acquired an unsupported winner');
    });

    test('rejects incomplete profile identities', async () => {
        await expect(evaluateUpgradeCanaryProfiles({ profileService: profileService(), libraryIds: { movie: 1 } }))
            .rejects.toThrow('current profiles for every synthetic library');
    });
});
