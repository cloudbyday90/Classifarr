/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { matchesPattern, validatePatterns } from './patterns.mjs';

function readJson(root, name) {
  const filename = resolve(root, name);
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.size > 65_536) {
    throw new Error('Markdown lint configuration must be a regular file of at most 64 KiB');
  }
  const value = JSON.parse(readFileSync(filename, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected a JSON object in ${name}`);
  }
  return value;
}

export function readLintConfiguration(root) {
  const config = readJson(root, '.markdownlint-repo.json');
  if (Object.keys(config).some(key => !['globs', 'ignores'].includes(key))) {
    throw new Error('Expected only globs and ignores in .markdownlint-repo.json');
  }
  validatePatterns(config.globs, 'globs');
  validatePatterns(config.ignores, 'ignores', { allowEmpty: true });
  // Standard rule configuration stays discoverable by editor integrations.
  return { ...config, config: readJson(root, '.markdownlint.json') };
}

export function selectMarkdownFiles(root, configuration, additionalPatterns = []) {
  const patterns = [...validatePatterns(configuration.globs, 'globs'),
    ...validatePatterns(additionalPatterns, 'arguments', { allowEmpty: true })];
  const ignores = validatePatterns(configuration.ignores, 'ignores', { allowEmpty: true });
  const ignored = path => ignores.some(pattern => matchesPattern(pattern, path));
  const files = new Set();
  for (const pattern of patterns) {
    // Walk only the literal directory prefix, not the entire checkout or data.
    const segments = pattern.split('/');
    const prefix = [];
    while (segments.length > 1 && !/[*?]/u.test(segments[0])) prefix.push(segments.shift());
    const base = prefix.join('/');
    let safeBase = true;
    for (let length = 1; length <= prefix.length; length++) {
      const directory = prefix.slice(0, length).join('/');
      if (ignored(directory)) { safeBase = false; break; }
      try {
        // Resolve literal prefixes by their actual spelling. lstat alone would
        // accept DATA for data on Windows, bypassing case-sensitive exclusions.
        const parent = prefix.slice(0, length - 1).join('/');
        const entry = readdirSync(resolve(root, parent), { withFileTypes: true })
          .find(candidate => candidate.name === prefix[length - 1]);
        if (!entry?.isDirectory()) { safeBase = false; break; }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        safeBase = false;
        break;
      }
    }
    const pending = safeBase && !ignored(base) ? [base] : [];
    let matched = false;
    while (pending.length) {
      const directory = pending.pop();
      for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        if (ignored(path)) continue;
        if (entry.isDirectory() && segments.length > 1) pending.push(path);
        else if (entry.isFile() && path.endsWith('.md') && matchesPattern(pattern, path)) {
          files.add(path);
          matched = true;
        }
      }
    }
    if (additionalPatterns.includes(pattern) && !matched) {
      throw new Error(`No eligible Markdown files matched: ${pattern}`);
    }
  }
  if (!files.size) throw new Error('No eligible Markdown files found');
  return [...files].sort();
}
