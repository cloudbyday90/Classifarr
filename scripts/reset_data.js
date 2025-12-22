const db = require('../server/src/config/database');
const { createLogger } = require('../server/src/utils/logger');
require('dotenv').config({ path: '../server/.env' });

const logger = createLogger('reset_data');

async function resetData() {
    try {
        console.log('Resetting database data...');

        // Truncate relevant tables but keep configuration (users, settings, libraries)
        // We want to clear classifications, analysis, queues, and patterns
        // We KEEP libraries because re-adding them is tedious, but we clear their items

        await db.query('BEGIN');

        // Clear items and history
        await db.query('TRUNCATE TABLE content_analysis_log RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE classification_history RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE learning_patterns RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE media_server_items RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE task_queue RESTART IDENTITY CASCADE');

        /* 
           Optionally, we could clear library_custom_rules if the user wants 100% fresh start,
           but usually "reset data" means "reset processed data".
           Let's clear custom rules too as they are part of the "Rule Builder" testing.
        */
        await db.query('TRUNCATE TABLE library_custom_rules RESTART IDENTITY CASCADE');

        // We do NOT clear 'libraries', 'users', 'settings', 'ollama_config', etc.
        // unless explicitly requested to factory reset.

        await db.query('COMMIT');

        console.log('Database reset complete!');
        console.log('Cleared: items, history, learning patterns, analysis logs, custom rules, task queues.');

        process.exit(0);
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Failed to reset data:', error);
        process.exit(1);
    }
}

resetData();
