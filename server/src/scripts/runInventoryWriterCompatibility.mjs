/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { readWriterSourceFiles } from './inventoryWriterCompatibility/sourceFiles.mjs';
import { evaluateWriterInventory } from './inventoryWriterCompatibility/inventory.mjs';

export function runInventoryWriterCompatibility(argv = process.argv.slice(2)) {
    if (!Array.isArray(argv) || argv.length) throw new Error('Writer inventory accepts no arguments');
    const root = resolve(import.meta.dirname, '../../..'), { files, gaps, bytes } = readWriterSourceFiles(root);
    return { ...evaluateWriterInventory(files, gaps), nodeVersion: process.version, sourceBytes: bytes, databaseConnections: 0, providerRequests: 0, writes: 0 };
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    try { process.stdout.write(`${JSON.stringify(runInventoryWriterCompatibility(), null, 2)}\n`); }
    catch { process.stderr.write('Inventory writer assessment failed; no source writes were performed.\n'); process.exitCode = 1; }
}
