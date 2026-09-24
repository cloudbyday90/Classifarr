/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {
    CANARY_AMBIGUOUS_PROBES,
    CANARY_HELD_OUT_PROBES,
    CANARY_LIBRARIES,
} from './libraryProfileUpgradeCanaryFixtures.mjs';

async function rankSameType(profileService, libraryIds, probe) {
    const candidates = CANARY_LIBRARIES.filter(library => library.mediaType === probe.mediaType);
    return Promise.all(candidates.map(async library => ({
        key: library.key,
        score: (await profileService.getProfileScoreDetails(libraryIds[library.key], {
            media_type: probe.mediaType,
            genres: probe.genres,
        })).finalScore,
    })));
}

/** A synthetic contract check, never an estimate of real classification accuracy. */
export async function evaluateUpgradeCanaryProfiles({ profileService, libraryIds }) {
    if (!profileService || typeof profileService.getProfileScoreDetails !== 'function' ||
        CANARY_LIBRARIES.some(library => !Number.isInteger(libraryIds?.[library.key]))) {
        throw new TypeError('Canary evaluation requires current profiles for every synthetic library');
    }
    const byMedia = [];
    for (const mediaType of ['movie', 'tv']) {
        let separated = 0;
        const probes = CANARY_HELD_OUT_PROBES.filter(probe => probe.mediaType === mediaType);
        for (const probe of probes) {
            const scores = await rankSameType(profileService, libraryIds, probe);
            const expected = scores.find(candidate => candidate.key === probe.expectedKey);
            if (scores.length !== 2 || !scores.every(candidate => Number.isFinite(candidate.score)) ||
                !expected || !scores.every(candidate => candidate.key === expected.key || expected.score > candidate.score)) {
                throw new Error(`Synthetic ${mediaType} profile probe lost its expected separation`);
            }
            separated++;
        }
        const ambiguous = CANARY_AMBIGUOUS_PROBES.find(probe => probe.mediaType === mediaType);
        const ambiguousScores = await rankSameType(profileService, libraryIds, ambiguous);
        if (ambiguousScores.length !== 2 || ambiguousScores[0].score !== ambiguousScores[1].score) {
            throw new Error(`Synthetic ${mediaType} ambiguity probe acquired an unsupported winner`);
        }
        byMedia.push({ mediaType, heldOutProbes: probes.length, separated, ambiguousTies: 1 });
    }
    return {
        protocol: 'synthetic_profile_separation_v1',
        byMedia,
        heldOutProbes: CANARY_HELD_OUT_PROBES.length,
        separated: byMedia.reduce((sum, row) => sum + row.separated, 0),
        ambiguousTies: byMedia.length,
        classificationQuality: {
            status: 'not_measured',
            independentlyCorrectedCases: 0,
            reasonId: 'independent_operator_corrections_unavailable_in_isolated_canary',
        },
        automaticRoutingAuthorized: false,
    };
}
