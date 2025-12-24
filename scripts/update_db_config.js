
const db = require('../server/src/config/database');
require('dotenv').config({ path: './server/.env' });

async function updateConfig() {
    try {
        console.log("Updating Ollama Config to 192.168.50.95...");

        // 1. Update config
        await db.query(`
      UPDATE ollama_config 
      SET host = '192.168.50.95', port = 11434, is_active = true 
      WHERE id = (SELECT id FROM ollama_config LIMIT 1)
    `);

        // 2. Insert if not exists (in case table was empty)
        const result = await db.query('SELECT * FROM ollama_config');
        if (result.rows.length === 0) {
            await db.query(`
        INSERT INTO ollama_config (host, port, model, temperature, is_active)
        VALUES ('192.168.50.95', 11434, 'qwen3:14b', 0.3, true)
      `);
        }

        // 3. Reset stuck 'processing' tasks to 'pending' so they retry
        console.log("Resetting stuck 'processing' tasks to 'pending'...");
        const resetResult = await db.query(`
      UPDATE task_queue 
      SET status = 'pending', attempts = 0, started_at = NULL 
      WHERE status = 'processing'
    `);
        console.log(`Reset ${resetResult.rowCount} stuck tasks.`);

        console.log("Database update complete.");
    } catch (err) {
        console.error("Error updating config:", err);
    } finally {
        process.exit();
    }
}

updateConfig();
