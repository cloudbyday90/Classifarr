/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { lstatSync, readFileSync } from 'node:fs';
import { readWriterSourceFiles } from './inventoryWriterCompatibility/sourceFiles.mjs';
import { evaluateWriterInventory } from './inventoryWriterCompatibility/inventory.mjs';
import { collectOwnershipInventory } from './inventoryWriterCompatibility/ownershipInventory.mjs';
import { evaluateOwnershipGate } from './inventoryWriterCompatibility/ownershipGate.mjs';

export function runInventoryWriterCompatibility(argv = process.argv.slice(2)) {
    if (!Array.isArray(argv) || (argv.length && (argv.length !== 1 || !['--check-ownership', '--ownership-report'].includes(argv[0])))) {
        throw new Error('Writer inventory accepts no arguments, --check-ownership or --ownership-report');
    }
    const root = resolve(import.meta.dirname, '../../..'), { files, gaps, bytes } = readWriterSourceFiles(root);
    const metadata = { nodeVersion: process.version, sourceBytes: bytes, databaseConnections: 0, providerRequests: 0, writes: 0 };
    if (argv.length) {
        const inventory = collectOwnershipInventory(files, gaps);
        if (argv[0] === '--ownership-report') return { ...inventory, ...metadata };
        const manifestUrl = new URL('./inventoryWriterCompatibility/ownershipReview.json', import.meta.url);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixed module-relative review file; no input controls the path.
        const stat = lstatSync(manifestUrl);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error('Invalid ownership review file');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixed module-relative file, bounded and symlink-checked above.
        const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
        return { ...evaluateOwnershipGate(inventory, manifest), ...metadata };
    }
    return { ...evaluateWriterInventory(files, gaps), ...metadata };
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    try {
        const report = runInventoryWriterCompatibility();
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (report.passed === false) process.exitCode = 1;
    }
    catch { process.stderr.write('Inventory writer assessment failed; no source writes were performed.\n'); process.exitCode = 1; }
}
