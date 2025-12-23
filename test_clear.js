
const db = require('./server/src/config/database');
const queueService = require('./server/src/services/queueService');
const { createLogger } = require('./server/src/utils/logger');

// Mock logger to avoid issues
const logger = createLogger('Test');

async function testClearAndResync() {
    try {
        console.log('Checking initial state...');
        const initial = await db.query(`
            SELECT COUNT(*) as count 
            FROM media_server_items 
            WHERE metadata->'content_analysis' IS NOT NULL
        `);
        console.log(`Initial items with content_analysis: ${initial.rows[0].count}`);

        if (parseInt(initial.rows[0].count) === 0) {
            console.log('No classified items found. Manually setting one for test...');
            await db.query(`
                UPDATE media_server_items 
                SET metadata = metadata || '{"content_analysis": {"type": "test", "confidence": 100}}'::jsonb
                WHERE id = (SELECT id FROM media_server_items LIMIT 1)
            `);
            const afterSet = await db.query(`
                SELECT COUNT(*) as count 
                FROM media_server_items 
                WHERE metadata->'content_analysis' IS NOT NULL
            `);
            console.log(`Items with content_analysis after manual set: ${afterSet.rows[0].count}`);
        }

        console.log('Running clearAndResync...');
        const result = await queueService.clearAndResync();
        console.log('Result:', result);

        const final = await db.query(`
            SELECT COUNT(*) as count 
            FROM media_server_items 
            WHERE metadata->'content_analysis' IS NOT NULL
        `);
        console.log(`Final items with content_analysis: ${final.rows[0].count}`);

        // Also check if classification history is empty
        const history = await db.query('SELECT COUNT(*) as count FROM classification_history');
        console.log(`Classification history count: ${history.rows[0].count}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

testClearAndResync();
