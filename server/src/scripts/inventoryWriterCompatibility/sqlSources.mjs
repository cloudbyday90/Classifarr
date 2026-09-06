/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// eslint-disable-next-line n/no-unpublished-import -- Offline source inventory uses the repository's existing development parser.
import { Linter } from 'eslint';
export const WRITER_SQL_PARSER = Object.freeze({ name: 'eslint', version: Linter.version });

export function extractWriterSqlSources({ path, source }) {
    if (path.endsWith('.sql')) return { fragments: [{ text: source, line: 1, rawSql: true }], gaps: [] };
    if (!/\.(?:mjs|js|cjs)$/.test(path)) return { fragments: [], gaps: [{ line: 1, reason: 'unsupported_source_language' }] };
    const fragments = [], gaps = [];
    const rule = { meta: { schema: [] }, create: () => ({
        Literal(node) {
            if (typeof node.value === 'string') fragments.push({ text: node.value, line: node.loc.start.line, rawSql: false });
        },
        TemplateLiteral(node) {
            fragments.push({ text: node.quasis.map(part => part.value.cooked ?? part.value.raw).join('__DYNAMIC__'), line: node.loc.start.line, rawSql: false });
        },
        CallExpression(node) {
            const name = node.callee.type === 'Identifier' ? node.callee.name : node.callee.property?.name ?? node.callee.property?.value;
            const first = node.arguments[0];
            if (['query', 'queryWithTimeout'].includes(name) && (!first || !['Literal', 'TemplateLiteral'].includes(first.type))) gaps.push({ line: node.loc.start.line, reason: 'indirect_query_argument' });
        }
    }) };
    const messages = new Linter().verify(source, [{ files: ['**/*.{js,mjs,cjs}'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        linterOptions: { noInlineConfig: true }, plugins: { inventory: { rules: { collect: rule } } }, rules: { 'inventory/collect': 'error' } }], { filename: path });
    gaps.push(...messages.filter(item => item.fatal).map(item => ({ line: item.line ?? 1, reason: 'source_parse_error' })));
    return { fragments, gaps };
}

/** Keep quoted content and line breaks; comment-only DML must not become a candidate. */
export function maskSqlComments(sql) {
    return sql.replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'|--[^\n]*|\/\*[\s\S]*?\*\//g,
        match => match.startsWith('--') || match.startsWith('/*') ? match.replace(/[^\n]/g, ' ') : match);
}
