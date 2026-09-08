/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildOverlapCohort } from './libraryOverlapCohorts.mjs';
import { compareOverlapCohorts } from './libraryOverlapComparison.mjs';
import { buildLibraryCommonTraitEvidence } from './libraryCommonTraitEvidence.mjs';
import { buildLibraryObservedTraitPrevalence } from './libraryObservedTraitPrevalence.mjs';
import { indexLibraryPolicyPurposeProvenance } from './libraryPolicyPurposeProvenance.mjs';
import { loadLibraryPolicyPurposeProvenanceRecords } from './libraryPolicyPurposeProvenancePersistence.mjs';
import { LIBRARY_OVERLAP_LIMITS, readLibraryOverlapSnapshot } from './libraryOverlapQuery.mjs';

export async function readLibraryOverlap(db, { includePolicyPurposeContext = false } = {}) {
    const snapshot = await readLibraryOverlapSnapshot(db);
    const exceeded = snapshot.row_count > LIBRARY_OVERLAP_LIMITS.rowLimit;
    const response = { version: 'library.overlap.v1', observedAt: snapshot.observed_at,
        status: exceeded ? 'capacity_exceeded' : 'available',
        scope: { population: 'active_library_inventory', selectionOrder: 'library_id_ascending',
            ...LIBRARY_OVERLAP_LIMITS, activeLibraryCount: snapshot.active_library_count,
            selectedLibraryCount: snapshot.libraries.length,
            excludedLibraryCount: snapshot.active_library_count - snapshot.libraries.length },
        inventoryRowCount: exceeded ? null : snapshot.row_count,
        inventoryRowCountLowerBound: snapshot.row_count, libraries: snapshot.libraries, pairs: [] };
    if (exceeded) return response;
    const groups = new Map(snapshot.libraries.map(library => [library.id, []]));
    for (const item of snapshot.items) groups.get(item.library_id).push(item);
    const cohorts = snapshot.libraries.map(library => {
        const items = groups.get(library.id);
        const evidenceItems = items.filter(item => item.source_conflict_blocks_authority !== true);
        return { ...library, inventoryRowCount: items.length,
            sourceConflictExcludedRowCount: items.length - evidenceItems.length,
            unsupportedTypeRowCount: evidenceItems.filter(item => !['movie', 'tv'].includes(item.media_type)).length,
            omittedTraitRowCount: evidenceItems.filter(item => item.omitted_traits).length,
            cohorts: ['movie', 'tv'].map(type => buildOverlapCohort(evidenceItems, type)) };
    });
    response.libraries = cohorts.map(library => ({ ...library, cohorts: library.cohorts.map(cohort => cohort.summary) }));
    response.observedTraitPrevalence = buildLibraryObservedTraitPrevalence({
        libraries: cohorts,
        activeLibraryCount: snapshot.active_library_count,
        entryLimit: LIBRARY_OVERLAP_LIMITS.traitEntryLimit,
    });
    if (includePolicyPurposeContext) {
        const libraryIds = cohorts.map((library) => library.id);
        const records = await loadLibraryPolicyPurposeProvenanceRecords({ db, libraryIds });
        response.commonTraitEvidence = buildLibraryCommonTraitEvidence({
            libraries: cohorts,
            activeLibraryCount: snapshot.active_library_count,
            entryLimit: LIBRARY_OVERLAP_LIMITS.traitEntryLimit,
            policyPurposeByLibrary: indexLibraryPolicyPurposeProvenance({ libraryIds, records }),
        });
    } else {
        response.commonTraitEvidence = buildLibraryCommonTraitEvidence({
            libraries: cohorts,
            activeLibraryCount: snapshot.active_library_count,
            entryLimit: LIBRARY_OVERLAP_LIMITS.traitEntryLimit,
        });
    }
    for (let i = 0; i < cohorts.length; i++) {
        for (let j = i + 1; j < cohorts.length; j++) {
            for (let type = 0; type < 2; type++) {
                const left = cohorts[i].cohorts[type];
                const right = cohorts[j].cohorts[type];
                if (!left.summary.rowCount || !right.summary.rowCount) continue;
                response.pairs.push({ leftLibraryId: cohorts[i].id, rightLibraryId: cohorts[j].id,
                    ...compareOverlapCohorts(left, right, LIBRARY_OVERLAP_LIMITS.traitEntryLimit) });
            }
        }
    }
    return response;
}
