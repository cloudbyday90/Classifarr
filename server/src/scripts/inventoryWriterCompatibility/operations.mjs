/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function sqlTokens(sql) {
    const tokens = []; let line = 1;
    for (let index = 0; index < sql.length;) {
        const start = index, char = sql[index], tokenLine = line;
        if (char === '"' || char === "'") {
            let value = ''; index++;
            while (index < sql.length) {
                if (sql[index] === char) {
                    if (sql[index + 1] === char) { value += char; index += 2; continue; }
                    index++; break;
                }
                if (sql[index] === '\n') line++;
                value += sql[index++];
            }
            tokens.push({ value, start, line: tokenLine, quoted: true, kind: char === '"' ? 'identifier' : 'string' });
        } else if (/[a-z_]/i.test(char)) {
            index++; while (index < sql.length && /[\w$]/.test(sql[index])) index++;
            tokens.push({ value: sql.slice(start, index), start, line: tokenLine, quoted: false, kind: 'identifier' });
        } else {
            index++; if (char === '\n') line++;
            if (',.;'.includes(char)) tokens.push({ value: char, start, line: tokenLine, kind: 'punctuation' });
        }
    }
    return tokens;
}
function targetAt(tokens, start) {
    let next = start;
    if (!tokens[next]?.quoted && tokens[next]?.value.toUpperCase() === 'ONLY') next++;
    if (tokens[next]?.kind !== 'identifier') return null;
    let target = tokens[next++].value;
    if (tokens[next]?.value === '.' && tokens[next + 1]?.kind === 'identifier') { target += `.${tokens[next + 1].value}`; next += 2; }
    return { target, next };
}
export function findWriterOperations(sql) {
    if (!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|COPY)\b/i.test(sql)) return [];
    const tokens = sqlTokens(sql), operations = [];
    for (let index = 0; index < tokens.length; index++) {
        if (tokens[index].kind !== 'identifier' || tokens[index].quoted) continue;
        const operation = tokens[index].value.toUpperCase(), following = tokens[index + 1]?.value.toUpperCase();
        let start = index + 1;
        if (operation === 'INSERT' || operation === 'MERGE') { if (following !== 'INTO') continue; start++; }
        else if (operation === 'DELETE') { if (following !== 'FROM') continue; start++; }
        else if (operation === 'TRUNCATE') { if (following === 'TABLE') start++; }
        else if (operation === 'UPDATE') { if (['OF', 'SET'].includes(following)) continue; }
        else if (operation !== 'COPY') continue;
        let target = targetAt(tokens, start);
        if (operation === 'COPY' && target) {
            const remaining = tokens.slice(target.next), end = remaining.findIndex(token => token.value === ';');
            const command = end === -1 ? remaining : remaining.slice(0, end);
            if (command.find(token => !token.quoted && ['FROM', 'TO'].includes(token.value.toUpperCase()))?.value.toUpperCase() !== 'FROM') continue;
        }
        while (target) {
            operations.push({ operation, target: target.target, index: tokens[index].start, line: tokens[index].line });
            target = operation === 'TRUNCATE' && tokens[target.next]?.value === ',' ? targetAt(tokens, target.next + 1) : null;
        }
    }
    return operations;
}
