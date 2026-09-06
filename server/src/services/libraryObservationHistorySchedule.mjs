/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { captureLibraryObservationSample } from './libraryObservationSample.mjs';

const logger = createLogger('LibraryObservationHistory');
export function registerLibraryObservationHistorySchedule(scheduler, {
    capture = () => captureLibraryObservationSample(db), log = logger,
} = {}) {
    const run = async () => {
        try { return await capture(); }
        catch { log.warn('Automatic observation history sample unavailable'); }
    };
    scheduler.schedule('library-observation-history', '*/5 * * * *', run);
    scheduler.scheduleInitial('library-observation-history', 150000, run);
}
