/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readdirSync } from 'node:fs';
import path from 'node:path';

const SKIPPED_DIRECTORY_NAMES = new Set(['node_modules', 'dist', 'coverage', 'postgres', 'logs', 'secrets', 'data']);
const PLAYWRIGHT_OUTPUT_PATHS = new Set(['client/test-results', 'client/playwright-report']);
const MAX_DEPTH = 6;

export function collectCodeHealthJsonFiles(root) {
  const files = [];

  function visit(directory, relativeDirectory, depth) {
    if (depth > MAX_DEPTH) return;
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
        if (entry.name.startsWith('.') || SKIPPED_DIRECTORY_NAMES.has(entry.name) || PLAYWRIGHT_OUTPUT_PATHS.has(relativePath)) continue;
        visit(filePath, relativePath, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'package-lock.json') {
        files.push(filePath);
      }
    }
  }

  visit(root, '', 0);
  return files.sort();
}
