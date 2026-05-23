import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('ReclassificationBatchSchema');

export async function ensureTables() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS reclassification_batches (
            id SERIAL PRIMARY KEY,
            status VARCHAR(50) DEFAULT 'pending',
            total_items INTEGER DEFAULT 0,
            completed_items INTEGER DEFAULT 0,
            failed_items INTEGER DEFAULT 0,
            skipped_items INTEGER DEFAULT 0,
            paused_at_item INTEGER DEFAULT NULL,
            pause_on_error BOOLEAN DEFAULT true,
            created_by VARCHAR(100) DEFAULT 'user',
            error_message TEXT DEFAULT NULL,
            started_at TIMESTAMP DEFAULT NULL,
            completed_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS reclassification_batch_items (
            id SERIAL PRIMARY KEY,
            batch_id INTEGER REFERENCES reclassification_batches(id) ON DELETE CASCADE,
            classification_id INTEGER NOT NULL,
            target_library_id INTEGER NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            validation_result JSONB DEFAULT NULL,
            execution_result JSONB DEFAULT NULL,
            error_message TEXT DEFAULT NULL,
            execution_order INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON reclassification_batch_items(batch_id)
    `);
    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_batch_items_status ON reclassification_batch_items(status)
    `);

    logger.info('Reclassification batch tables initialized');
}
