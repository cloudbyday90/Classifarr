/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { assertMatchingCatalogs, normalizeCatalogDump, rehearseReleaseSchema } from '../scripts/schemaReleaseReplay.mjs';
import { dumpIsolatedCatalog } from '../scripts/runSchemaReleaseReplay.mjs';

describe('released-schema replay gate', () => {
    test('normalizes only known PostgreSQL dump presentation differences', () => {
        const legacy = [
            '-- Dumped from database version 18.4',
            '--', '-- Name: b; Type: TABLE; Schema: public; Owner: -', '--',
            "    CONSTRAINT check_b CHECK (x = ANY ((ARRAY['one'::character varying, 'two'::character varying])::text[])),",
            '    value text CONSTRAINT inherited_name_not_null NOT NULL,',
            '--', '-- Name: a; Type: TABLE; Schema: public; Owner: -', '--',
            'SELECT 1;', '\\restrict abc', '',
        ].join('\n');
        const current = [
            '-- Dumped by pg_dump version 18.6',
            '--', '-- Name: a; Type: TABLE; Schema: public; Owner: -', '--',
            'SELECT 1;',
            '--', '-- Name: b; Type: TABLE; Schema: public; Owner: -', '--',
            "    CONSTRAINT check_b CHECK (x = ANY (ARRAY[('one'::character varying)::text, ('two'::character varying)::text])),",
            '    value text NOT NULL,', '\\unrestrict def', '',
        ].join('\n');
        expect(normalizeCatalogDump(legacy)).toBe(normalizeCatalogDump(current));
        expect(() => assertMatchingCatalogs(legacy, current.replace("'two'", "'three'"))).toThrow('differs');
        expect(() => assertMatchingCatalogs(legacy, current.replace('value text NOT NULL', 'value text'))).toThrow('differs');
    });

    test('refuses a non-disposable database before loading either schema', async () => {
        const query = jest.fn(async () => ({ rows: [{ name: 'classifarr', ledger: null, libraries: null }] }));
        await expect(rehearseReleaseSchema({
            releaseDb: { query }, currentDb: { query },
            releaseSchema: 'CREATE TABLE public.schema_migrations (',
            currentSchema: 'CREATE TABLE public.schema_migrations (',
            dumpCatalog: jest.fn(),
        })).rejects.toThrow('Refusing to load a schema');
        expect(query).toHaveBeenCalledTimes(1);
    });

    test.each([
        sql => sql.replace(' OR ', ' AND '),
        sql => sql.replace(' OR OLD.title IS DISTINCT FROM NEW.title', ''),
        sql => sql.replace('IS DISTINCT FROM', '<>'),
        sql => sql.replace('BEFORE UPDATE OF tmdb_id, title', 'AFTER UPDATE OF tmdb_id'),
        sql => sql.replace('reset_clocks()', 'different_function()'),
    ])('continues to reject trigger logic and contract drift', mutate => {
        const trigger = 'CREATE TRIGGER reset_clocks BEFORE UPDATE OF tmdb_id, title ON public.items ' +
            'FOR EACH ROW WHEN (OLD.tmdb_id IS DISTINCT FROM NEW.tmdb_id OR OLD.title IS DISTINCT FROM NEW.title) ' +
            'EXECUTE FUNCTION reset_clocks();';
        expect(() => assertMatchingCatalogs(trigger, mutate(trigger))).toThrow('differs');
    });

    test('dumps only named replay databases in a validated container', () => {
        const exec = jest.fn(() => 'catalog');
        expect(dumpIsolatedCatalog({ containerId: 'a'.repeat(64), dbName: 'classifarr_replay_release',
            user: 'rehearsal', password: 'secret', exec })).toBe('catalog');
        expect(exec.mock.calls[0][1]).toContain('--schema-only');
        expect(() => dumpIsolatedCatalog({ containerId: 'a'.repeat(64), dbName: 'classifarr',
            user: 'rehearsal', password: 'secret', exec })).toThrow('Refusing');
    });
});
