/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve, relative } from 'node:path';
import { lint } from 'markdownlint/promise';
import { readLintConfiguration, selectMarkdownFiles } from './files.mjs';

export async function runMarkdownLint({ root, patterns = [], log = console.log, error = console.error }) {
  const configuration = readLintConfiguration(root);
  const files = selectMarkdownFiles(root, configuration, patterns);
  let violations = 0;
  // Keep parser work bounded to small batches rather than loading all documents.
  for (let offset = 0; offset < files.length; offset += 32) {
    const result = await lint({
      files: files.slice(offset, offset + 32).map(file => resolve(root, file)),
      config: configuration.config,
    });
    for (const [filename, diagnostics] of Object.entries(result)) {
      for (const diagnostic of diagnostics) {
        violations++;
        const path = relative(root, filename).replaceAll('\\', '/');
        error(`${path}:${diagnostic.lineNumber}:${diagnostic.errorRange?.[0] ?? 1} ${diagnostic.ruleNames[0]} ${diagnostic.ruleDescription}${diagnostic.errorDetail ? ` (${diagnostic.errorDetail})` : ''}`);
      }
    }
  }
  log(`Markdown: ${files.length} files checked; ${violations} errors`);
  return violations ? 1 : 0;
}
