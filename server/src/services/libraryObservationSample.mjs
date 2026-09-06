/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildLibraryObservationHealth } from './libraryObservationHealthService.mjs';
import { readLibraryObservationSamplingSnapshot } from './libraryObservationSamplingQuery.mjs';
import { persistLibraryObservationSample } from './libraryObservationSamplingPersistence.mjs';

export async function captureLibraryObservationSample(db) {
    const snapshot = await readLibraryObservationSamplingSnapshot(db);
    if (!snapshot.due) return { captured: false };
    return persistLibraryObservationSample(db, snapshot, buildLibraryObservationHealth(snapshot));
}
