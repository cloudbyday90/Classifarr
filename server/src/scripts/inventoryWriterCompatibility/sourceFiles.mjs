/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/* eslint-disable security/detect-non-literal-fs-filename -- Git-listed code paths are extension-filtered, containment-checked and symlinks are refused. */
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { relative, resolve, isAbsolute } from 'node:path';

export const WRITER_SOURCE_ROOTS = Object.freeze(['server/src', 'scripts', 'execution', 'database/migrations', 'database/schema']);
const inside = (root, path) => { const part = relative(root, path); return part !== '..' && !part.startsWith('..\\') && !part.startsWith('../') && !isAbsolute(part); };
export function readWriterSourceFiles(root) {
    const actualRoot = realpathSync(root);
    const names = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...WRITER_SOURCE_ROOTS],
        { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\0'))].filter(path =>
        /\.(?:mjs|js|cjs|sql|py)$/.test(path) && !/(?:^|\/)(?:__tests__|node_modules|fixtures)(?:\/|$)|\.test\./.test(path)).sort();
    if (names.length > 20000) throw new Error('Writer source file budget exceeded');
    const files = [], gaps = []; let bytes = 0;
    for (const path of names) {
        const absolute = resolve(root, path);
        if (!inside(root, absolute)) throw new Error('Writer source escaped repository');
        const stat = lstatSync(absolute);
        if (stat.isSymbolicLink() || !stat.isFile() || !inside(actualRoot, realpathSync(absolute))) { gaps.push({ path, reason: 'nonlocal_or_nonregular_source' }); continue; }
        if (stat.size > 2 * 1024 * 1024) { gaps.push({ path, reason: 'source_size_limit' }); continue; }
        bytes += stat.size;
        if (bytes > 256 * 1024 * 1024) throw new Error('Writer source byte budget exceeded');
        files.push({ path, source: readFileSync(absolute, 'utf8') });
    }
    return { files, gaps, bytes };
}
