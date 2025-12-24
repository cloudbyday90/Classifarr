
const db = require('./server/src/config/database');
require('dotenv').config({ path: './server/.env' });

async function checkQueue() {
    try {
        console.log("Checking Task Queue...");
        const counts = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM task_queue 
      GROUP BY status
    `);
        console.table(counts.rows);

        console.log("\nChecking 'Processing' items:");
        const processing = await db.query(`
      SELECT id, task_type, created_at, started_at, attempts 
      FROM task_queue 
      WHERE status = 'processing'
    `);
        console.table(processing.rows);

        console.log("\nChecking recent Error Logs:");
        const errors = await db.query(`
        SELECT message, created_at 
        FROM error_log 
        ORDER BY created_at DESC 
        LIMIT 5
    `);
        console.table(errors.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkQueue();
