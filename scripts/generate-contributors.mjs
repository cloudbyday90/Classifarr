#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

function getContributors() {
  const output = execSync('git log --format="%aN <%aE>"', { encoding: 'utf8' });
  return [...new Set(output.split(/\r?\n/).map(line => line.trim()).filter(Boolean))].sort();
}

function generateContributorsFile() {
  const contributors = getContributors();

  const content = `# Contributors

This file lists all contributors to the Classifarr project, automatically generated from git history.

## Core Team

${contributors.join('\n')}

---

## How to Contribute

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

**This file is auto-generated.** To update it, run:
\`\`\`bash
npm run generate-contributors
\`\`\`
`;

  fs.writeFileSync('CONTRIBUTORS.md', content, 'utf8');
  console.log(`✅ Generated CONTRIBUTORS.md with ${contributors.length} contributor(s)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  generateContributorsFile();
}
