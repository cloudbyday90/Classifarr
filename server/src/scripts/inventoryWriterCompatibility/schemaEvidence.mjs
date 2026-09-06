/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sqlTokens } from './operations.mjs';
import { maskSqlComments } from './sqlSources.mjs';

const keyword = token => token?.kind === 'identifier' && !token.quoted ? token.value.toUpperCase() : '';
function nameAt(tokens, index) {
    if (tokens[index]?.kind !== 'identifier') return null;
    if (tokens[index + 1]?.value === '.' && tokens[index + 2]?.kind === 'identifier') return `${tokens[index].value}.${tokens[index + 2].value}`;
    return tokens[index].value;
}
const relation = name => name?.toLowerCase().replace(/^public\./, '') ?? null;
function phraseAt(tokens, words) {
    return tokens.findIndex((token, index) => keyword(token) === words[0] && words.every((word, offset) => keyword(tokens[index + offset]) === word));
}
function action(tokens, event) {
    const index = phraseAt(tokens, ['ON', event]);
    if (index === -1) return 'NO_ACTION';
    if (keyword(tokens[index + 2]) === 'CASCADE') return 'CASCADE';
    if (keyword(tokens[index + 2]) === 'SET' && ['NULL', 'DEFAULT'].includes(keyword(tokens[index + 3]))) return `SET_${keyword(tokens[index + 3])}`;
    return 'NO_ACTION';
}

/** Linear token passes over authoritative pg_dump ALTER TABLE and CREATE TRIGGER statements. */
export function readWriterSchemaEvidence(source) {
    const tokens = sqlTokens(maskSqlComments(source)), statements = [];
    let statement = [];
    for (const token of tokens) {
        if (token.value === ';' && token.kind === 'punctuation') { statements.push(statement); statement = []; }
        else statement.push(token);
    }
    if (statement.length) statements.push(statement);
    const edges = [], triggers = [];
    for (const parts of statements) {
        if (keyword(parts[0]) === 'ALTER' && keyword(parts[1]) === 'TABLE' && phraseAt(parts, ['FOREIGN', 'KEY']) !== -1) {
            const child = relation(nameAt(parts, keyword(parts[2]) === 'ONLY' ? 3 : 2));
            const reference = phraseAt(parts, ['REFERENCES']), parent = reference === -1 ? null : relation(nameAt(parts, reference + 1));
            if (child && parent) edges.push({ child, parent, onDelete: action(parts, 'DELETE'), onUpdate: action(parts, 'UPDATE') });
        }
        const triggerStart = keyword(parts[0]) === 'CREATE' ? (keyword(parts[1]) === 'OR' && keyword(parts[2]) === 'REPLACE' ? 3 : 1) : -1;
        if (triggerStart !== -1 && keyword(parts[triggerStart]) === 'TRIGGER') {
            const on = phraseAt(parts, ['ON']), execute = phraseAt(parts, ['EXECUTE', 'FUNCTION']);
            if (on !== -1 && relation(nameAt(parts, on + 1)) === 'media_server_items') triggers.push({ name: nameAt(parts, triggerStart + 1),
                line: parts[0].line, function: execute === -1 ? null : nameAt(parts, execute + 2) });
        }
    }
    return { edges, triggers };
}
