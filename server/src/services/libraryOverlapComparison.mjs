/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { overlapPercent } from './libraryOverlapCohorts.mjs';

function coverageStatus(left, right, leftObserved, rightObserved) {
    if (!leftObserved || !rightObserved) return 'insufficient_coverage';
    return left.summary.unidentifiedRowCount || right.summary.unidentifiedRowCount ||
        leftObserved < left.identities.size || rightObserved < right.identities.size ? 'partial_coverage' : 'complete_coverage';
}

export function compareOverlapCohorts(left, right, entryLimit) {
    const sharedIdentityCount = [...left.identities.keys()].filter(id => right.identities.has(id)).length;
    return {
        mediaType: left.summary.mediaType, sharedIdentityCount,
        leftIdentityCount: left.identities.size, rightIdentityCount: right.identities.size,
        leftOverlapPercent: overlapPercent(sharedIdentityCount, left.identities.size),
        rightOverlapPercent: overlapPercent(sharedIdentityCount, right.identities.size),
        identityStatus: coverageStatus(left, right, left.identities.size, right.identities.size),
        traits: left.traits.map((trait, index) => {
            const other = right.traits[index];
            const entries = [...trait.counts].filter(([value]) => other.counts.has(value)).map(([value, leftCount]) => {
                const rightCount = other.counts.get(value);
                return { value, leftCount, rightCount,
                    leftPercentOfIdentities: overlapPercent(leftCount, left.identities.size),
                    rightPercentOfIdentities: overlapPercent(rightCount, right.identities.size) };
            }).sort((a, b) => Math.min(b.leftCount / left.identities.size, b.rightCount / right.identities.size) -
                Math.min(a.leftCount / left.identities.size, a.rightCount / right.identities.size) ||
                (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
            return { field: trait.summary.field,
                status: coverageStatus(left, right, trait.summary.observedIdentityCount, other.summary.observedIdentityCount),
                leftObservedIdentityCount: trait.summary.observedIdentityCount,
                rightObservedIdentityCount: other.summary.observedIdentityCount,
                leftConflictingIdentityCount: trait.summary.conflictingIdentityCount,
                rightConflictingIdentityCount: other.summary.conflictingIdentityCount,
                commonValueCount: entries.length, truncated: entries.length > entryLimit, entries: entries.slice(0, entryLimit) };
        }),
    };
}
