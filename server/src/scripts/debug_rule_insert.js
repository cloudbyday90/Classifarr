const db = require('../config/database');

async function test() {
    try {
        console.log('Testing insert of rule into library 2...');

        // Simulate the exact rule payload
        const rule_type = 'keyword';
        const operator = 'contains';
        const value = 'christmas,xmas,holiday,santa,snowman,elf';
        const is_exception = false;
        const priority = 0;
        const description = 'Christmas/Holiday content (67% match)';
        const library_id = 2; // Assuming Library #2 based on screenshot

        const result = await db.query(
            `INSERT INTO library_rules (library_id, rule_type, operator, value, is_exception, priority, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [library_id, rule_type, operator, value, is_exception, priority, description]
        );

        console.log('Success! Rule created:', result.rows[0]);
    } catch (err) {
        console.error('INSERT FAILED:', err.message);
        if (err.detail) console.error('Detail:', err.detail);
        if (err.hint) console.error('Hint:', err.hint);
    } finally {
        // Keep connection open briefly to ensure logs flush? No, pg client handles it?
        // db pool might need explicit closing but script exit handles it.
        process.exit();
    }
}

test();
