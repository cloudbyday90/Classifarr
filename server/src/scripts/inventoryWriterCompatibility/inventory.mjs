/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { extractWriterSqlSources, maskSqlComments, WRITER_SQL_PARSER } from './sqlSources.mjs';
import { findWriterOperations, sqlTokens } from './operations.mjs';
import { readWriterSchemaEvidence } from './schemaEvidence.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const relation = value => value.replaceAll('"', '').replace(/\s/g, '').toLowerCase().replace(/^public\./, '');
function scope(path) {
    if (path === 'database/schema/current.sql') return 'schema_snapshot';
    if (path.startsWith('database/migrations/')) return 'migration';
    if (path.startsWith('server/src/scripts/') || path.startsWith('scripts/') || path.startsWith('execution/')) return 'maintenance_or_prototype';
    return 'runtime_source';
}
function parentRelations(edges, field) {
    const reached = new Set(['media_server_items']);
    for (let changed = true; changed;) {
        changed = false;
        for (const edge of edges) if (edge[field] !== 'NO_ACTION' && reached.has(edge.child) && !reached.has(edge.parent)) { reached.add(edge.parent); changed = true; }
    }
    reached.delete('media_server_items'); return reached;
}

export function evaluateWriterInventory(files, sourceGaps = []) {
    const schema = files.find(file => file.path === 'database/schema/current.sql');
    const evidence = readWriterSchemaEvidence(schema?.source ?? ''), edges = evidence.edges;
    const deleteParents = parentRelations(edges, 'onDelete'), updateParents = parentRelations(edges, 'onUpdate');
    const candidates = [], gaps = [...sourceGaps], triggers = evidence.triggers.map(item => ({ path: schema.path, ...item })), fingerprint = createHash('sha256');
    if (!schema) gaps.push({ path: 'database/schema/current.sql', line: 1, reason: 'missing_authoritative_schema' });
    for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
        fingerprint.update(JSON.stringify([file.path, digest(file.source)]));
        const extraction = extractWriterSqlSources(file);
        gaps.push(...extraction.gaps.map(gap => ({ path: file.path, ...gap })));
        for (const fragment of extraction.fragments) {
            const sql = maskSqlComments(fragment.text);
            if (/\bEXECUTE\b/i.test(sql)) {
                const tokens = sqlTokens(sql);
                for (let i = 0; i < tokens.length; i++) if (!tokens[i].quoted && tokens[i].value.toUpperCase() === 'EXECUTE' &&
                    !['FUNCTION', 'PROCEDURE'].includes(tokens[i + 1]?.value.toUpperCase())) gaps.push({ path: file.path,
                    line: fragment.line, reason: 'dynamic_sql_execution' });
            }
            for (const match of findWriterOperations(sql)) {
                const target = relation(match.target), operation = match.operation;
                const direct = target === 'media_server_items';
                const parent = (operation === 'DELETE' || operation === 'TRUNCATE' || operation === 'MERGE') ? deleteParents.has(target) || updateParents.has(target) : updateParents.has(target);
                if (!direct && !parent && !target.includes('__dynamic__')) continue;
                const line = fragment.rawSql ? fragment.line + match.line - 1 : fragment.line;
                const kind = direct ? 'direct' : parent ? 'cascade_parent' : 'dynamic_target';
                candidates.push({ path: file.path, line, scope: scope(file.path), operation, target, kind,
                    statementDigest: digest(fragment.text), sourceOffset: match.index,
                    revisionPredicateMentioned: /\bxmin\b/i.test(sql), compatibility: 'not_proven' });
            }
        }
    }
    const unique = [...new Map(candidates.map(item => [JSON.stringify([item.path, item.line, item.operation, item.target, item.statementDigest, item.sourceOffset]), item])).values()];
    return { contract: 'inventory.writer-compatibility.v1', parser: WRITER_SQL_PARSER, sourceFingerprint: fingerprint.digest('hex'), scannedFiles: files.length,
        productionCompatible: false, completeness: 'static_candidates_only', candidates: unique, triggers,
        cascadeParents: { delete: [...deleteParents].sort(), update: [...updateParents].sort() },
        cascadeEdges: edges.filter(edge => edge.child === 'media_server_items' || deleteParents.has(edge.child) || updateParents.has(edge.child)), gaps,
        limitations: ['No arbitrary SQL data-flow or runtime reachability proof', 'Indirect query arguments require resolution',
            'Schema snapshot does not prove deployed triggers or privileges', 'Non-JavaScript/SQL sources remain explicit gaps'] };
}
