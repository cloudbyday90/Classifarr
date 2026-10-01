/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runImageIndexMaintenance } from './imageIndexMaintenance.mjs';
import { getImageIndexHandoff } from './imageIndexHandoffClient.mjs';

export async function rebuildImageIndexes(task, { db, logger, maintenance = runImageIndexMaintenance,
    handoff = getImageIndexHandoff(),
}) {
    const result = handoff ? await handoff.request(task) : await maintenance({ database: db, task });
    if (result.status === 'unavailable') throw new Error('image_index_handoff_unavailable');
    if (result.status === 'complete') logger.info('Image indexes verified and queue claim completed.', result);
    else logger.debug('Image index maintenance deferred.', result);
    return result;
}
