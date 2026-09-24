/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import fs from 'node:fs';
import { resolve } from 'node:path';
import { createMigrationRunner } from '../config/migrations.mjs';

export const RELEASE_DB = 'classifarr_replay_release';
export const CURRENT_DB = 'classifarr_replay_current';
const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../database/migrations');

function normalizeTextLiteralArrays(line) {
    return line.replace(/(?:\(ARRAY\[([^\]]+)\]\)::text\[\]|ARRAY\[([^\]]+)\])/g, (original, castArray, directArray) => {
        const terms = (castArray ?? directArray).split(', ');
        const values = terms.map(term => term.match(/^(?:'((?:[^']|'')+)'::character varying|\('((?:[^']|'')+)'::character varying\)::text)$/));
        if (values.some(value => !value)) return original;
        return `ARRAY[${values.map(value => `'${value[1] ?? value[2]}'::text`).join(', ')}]`;
    });
}

export function normalizeCatalogDump(sql) {
    const normalized = String(sql).replace(/\r\n/g, '\n')
        .split('\n')
        .filter(line => !/^\\(?:un)?restrict\b/.test(line))
        .filter(line => !/^-- Dumped (?:from database|by pg_dump) version /.test(line))
        // pg_dump can emit equivalent varchar[] and text[] spellings after a
        // snapshot restore. Normalize only arrays of exact string literals.
        .map(normalizeTextLiteralArrays)
        // PostgreSQL 18 gives NOT NULL constraints names based on their
        // original table; a later table rename retains that historical name.
        .map(line => line.replace(/ CONSTRAINT [a-zA-Z0-9_]+ NOT NULL(?=[,\s])/g, ' NOT NULL'))
        .join('\n');
    const sections = normalized.split(/(?=--\n-- Name: )/);
    const preamble = sections[0].startsWith('--\n-- Name: ') ? '' : sections.shift();
    return [preamble, ...sections.sort()].join('');
}

export function assertMatchingCatalogs(replayedDump, snapshotDump) {
    const replayed = normalizeCatalogDump(replayedDump).split('\n');
    const snapshot = normalizeCatalogDump(snapshotDump).split('\n');
    const differingLine = replayed.findIndex((line, index) => line !== snapshot[index]);
    if (differingLine === -1 && replayed.length === snapshot.length) return;
    const lineNumber = differingLine === -1 ? Math.min(replayed.length, snapshot.length) + 1 : differingLine + 1;
    const excerpt = value => JSON.stringify((value ?? '<end>').slice(0, 240));
    throw new Error(`Release migration replay differs from the current snapshot at catalog line ${lineNumber}. ` +
        `Replayed: ${excerpt(replayed[lineNumber - 1])}; ` +
        `fresh: ${excerpt(snapshot[lineNumber - 1])}. ` +
        'Inspect the changed migration and regenerate database/schema/current.sql only after reconciling the difference.');
}

async function assertEmptyReplayDatabase(dbClient, expectedName) {
    const { rows } = await dbClient.query(`SELECT current_database() AS name,
        to_regclass('public.schema_migrations') AS ledger,
        to_regclass('public.libraries') AS libraries`);
    if (rows[0]?.name !== expectedName || rows[0]?.ledger !== null || rows[0]?.libraries !== null) {
        throw new Error(`Refusing to load a schema outside the empty ${expectedName} database`);
    }
}

async function assertCompleteLedger(dbClient, migrationFiles) {
    const { rows } = await dbClient.query('SELECT filename FROM public.schema_migrations ORDER BY filename');
    const actual = rows.map(row => row.filename).sort();
    const expected = [...migrationFiles].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('A replay database is missing migrations or contains an unexpected migration ledger entry');
    }
}

/** All writes remain in caller-supplied, explicitly named disposable databases. */
export async function rehearseReleaseSchema({ releaseDb, currentDb, releaseSchema, currentSchema,
    dumpCatalog }) {
    if (typeof releaseSchema !== 'string' || typeof currentSchema !== 'string' ||
        !releaseSchema.includes('CREATE TABLE public.schema_migrations (') ||
        !currentSchema.includes('CREATE TABLE public.schema_migrations (') ||
        typeof dumpCatalog !== 'function') {
        throw new Error('Both checked schema snapshots and a catalog dumper are required');
    }
    await assertEmptyReplayDatabase(releaseDb, RELEASE_DB);
    await assertEmptyReplayDatabase(currentDb, CURRENT_DB);
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter(name => name.endsWith('.sql'));
    if (migrationFiles.length === 0) throw new Error('No current migration files were found');

    await releaseDb.query(releaseSchema);
    const replay = await createMigrationRunner({ dbClient: releaseDb, env: { MIGRATIONS_DIR } }).run();
    if (replay.applied === 0) throw new Error('The release replay applied no post-release migrations');
    await currentDb.query(currentSchema);
    const fresh = await createMigrationRunner({ dbClient: currentDb, env: { MIGRATIONS_DIR } }).run();
    if (fresh.applied !== 0) throw new Error('The current snapshot omitted one or more migration ledger entries');
    await assertCompleteLedger(releaseDb, migrationFiles);
    await assertCompleteLedger(currentDb, migrationFiles);

    assertMatchingCatalogs(await dumpCatalog(RELEASE_DB), await dumpCatalog(CURRENT_DB));
    return { migrationsReplayed: replay.applied, migrationsTotal: migrationFiles.length, catalogMatch: true };
}
