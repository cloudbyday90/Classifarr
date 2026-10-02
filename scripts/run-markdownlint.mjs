/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fileURLToPath } from 'node:url';
import { runMarkdownLint } from './markdownlint/run.mjs';

try {
  process.exitCode = await runMarkdownLint({
    root: fileURLToPath(new URL('../', import.meta.url)),
    patterns: process.argv.slice(2),
  });
} catch (error) {
  console.error(`Markdown lint failed: ${error.message}`);
  process.exitCode = 1;
}
