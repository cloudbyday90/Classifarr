#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { execSync } = require('child_process');
const fs = require('fs');

function getContributors() {
  const output = execSync('git log --format="%aN <%aE>" | sort -u', { encoding: 'utf8' });
  return output.trim().split('\n').filter(Boolean);
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

generateContributorsFile();
