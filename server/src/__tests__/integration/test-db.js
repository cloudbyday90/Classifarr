const { newDb } = require('pg-mem');

const db = newDb();

// Register to_regclass function
db.public.registerFunction({
    name: 'to_regclass',
    args: [db.public.getType('text')],
    returns: db.public.getType('text'),
    implementation: (name) => {
        try {
            db.public.getTable(name);
            return name;
        } catch (e) {
            return null;
        }
    }
});

// Register gen_random_uuid
db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: db.public.getType('uuid'),
    implementation: () => '00000000-0000-0000-0000-000000000000'
});

module.exports = db;
