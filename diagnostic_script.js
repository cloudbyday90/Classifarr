const db = require('./src/config/database');

async function runDiagnostics() {
    try {
        console.log('--- DIAGNOSTICS START ---');

        const total = await db.query('SELECT COUNT(*) FROM media_server_items');
        console.log(`Total Items: ${total.rows[0].count}`);

        const nullContent = await db.query(`
            SELECT COUNT(*) FROM media_server_items 
            WHERE metadata->'content_analysis' IS NULL
        `);
        console.log(`Null Content Analysis: ${nullContent.rows[0].count}`);

        const sourceLibraryNoOmdb = await db.query(`
            SELECT COUNT(*) FROM media_server_items 
            WHERE metadata->'omdb' IS NULL 
            AND metadata->'content_analysis'->>'type' = 'source_library'
        `);
        console.log(`Source Library w/o OMDb: ${sourceLibraryNoOmdb.rows[0].count}`);

        const queueStats = await db.query(`
            SELECT status, COUNT(*) 
            FROM task_queue 
            WHERE task_type = 'metadata_enrichment'
            GROUP BY status
        `);
        console.log('Enrichment Queue:', queueStats.rows);

        const omdbConfig = await db.query('SELECT is_active, daily_limit, requests_today FROM omdb_config');
        console.log('OMDb Config:', omdbConfig.rows);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
runDiagnostics();
