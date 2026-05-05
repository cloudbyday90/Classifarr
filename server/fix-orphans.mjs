import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, 'src/__tests__');

function findFiles(dir, ext) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

const testFiles = findFiles(testDir, '.test.mjs');
let fixed = 0;

for (const file of testFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  const original = content;

  // Fix orphaned multi-line mock blocks.
  // Pattern: after removing "jest.mock('../X', () => ({" the remaining lines are:
  //   <indent>createLogger: () => ({
  //   ...
  //   }))
  // We need to remove these orphaned blocks.

  // Strategy: Find all orphaned closing "}))" that don't have a matching opening
  // and remove the block from the previous blank line or statement to the "}))" + trailing newline.

  // More specific: remove blocks that look like:
  //   <something>: () => ({
  //     ...
  //   })
  // }));
  // where the opening jest.mock line was already removed

  // Actually, let me just look for the specific orphan pattern and remove it
  const lines = content.split('\n');
  const result = [];
  let skip = false;
  let parenDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Detect start of orphaned block: a line that starts with property notation
    // like "createLogger:" or has "{ ...mockX" but is NOT inside a jest.unstable_mockModule call
    if (!skip && i > 0) {
      const prevTrimmed = lines[i - 1].trim();

      // Check if this line starts an orphaned factory
      // The previous line was the last line of a jest.unstable_mockModule or blank
      // and this line starts with something that looks like a factory body
      const isOrphanStart = (
        (trimmed.startsWith('createLogger:') || 
         trimmed.startsWith('{ ...mock') ||
         trimmed.startsWith('...mock')) &&
        !prevTrimmed.includes('jest.unstable_mockModule') &&
        !prevTrimmed.includes('jest.mock') &&
        prevTrimmed !== ''
      );

      if (isOrphanStart) {
        // Skip until we find the closing }));
        skip = true;
        parenDepth = 0;
        // Count parens in this line
        for (const ch of lines[i]) {
          if (ch === '(' || ch === '{') parenDepth++;
          if (ch === ')' || ch === '}') parenDepth--;
        }
        continue;
      }
    }

    if (skip) {
      for (const ch of lines[i]) {
        if (ch === '(' || ch === '{') parenDepth++;
        if (ch === ')' || ch === '}') parenDepth--;
      }
      if (parenDepth <= 0 && trimmed.endsWith('});')) {
        skip = false;
        continue;
      }
      if (parenDepth <= 0 && trimmed.endsWith('}));')) {
        skip = false;
        continue;
      }
      continue;
    }

    result.push(lines[i]);
  }

  content = result.join('\n');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    const relPath = path.relative(__dirname, file);
    console.log(`Fixed orphan: ${relPath}`);
    fixed++;
  }
}

console.log(`\nTotal orphan blocks fixed: ${fixed}`);
