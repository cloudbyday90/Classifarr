
const db = require('./server/src/config/database');
require('dotenv').config({ path: './server/.env' });

async function checkConfig() {
    try {
        console.log("Checking Ollama Config...");
        const res = await db.query('SELECT * FROM ollama_config');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkConfig();
