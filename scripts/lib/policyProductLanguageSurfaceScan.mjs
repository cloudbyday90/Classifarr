/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  POLICY_PRODUCT_LANGUAGE_SURFACE_IDS,
  buildPolicyProductLanguageAudit,
} from './policyProductLanguageAudit.mjs';
import { collectRepositoryTextFiles } from './repositoryTextFileCollection.mjs';

const PRODUCT_LANGUAGE_SURFACE_DEFINITIONS = Object.freeze([
  {
    surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.RUNTIME_UI,
    includedRoots: ['client/src'],
    shouldIncludeFile: file => !isTestFile(file.path),
  },
  {
    surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.RUNTIME_SERVER,
    includedRoots: ['server/src'],
    shouldIncludeFile: file => !isTestFile(file.path),
  },
  {
    surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.OPERATOR_COMMANDS,
    includedRoots: ['package.json', 'client/package.json', 'server/package.json'],
  },
  {
    surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.API_DOCUMENTATION,
    includedRoots: ['docs/api'],
  },
  {
    surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.PRODUCT_DOCUMENTATION,
    includedRoots: ['README.md'],
  },
  {
    surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.RELEASE_NOTES,
    includedRoots: ['RELEASE_NOTES.md'],
    mapFiles: files => files.map(file => ({
      ...file,
      content: extractCurrentReleaseNotes(file.content),
    })),
  },
  {
    surfaceId: POLICY_PRODUCT_LANGUAGE_SURFACE_IDS.UNRELEASED_CHANGELOG,
    includedRoots: ['CHANGELOG.md'],
    mapFiles: files => files.map(file => ({
      ...file,
      content: extractUnreleasedChangelog(file.content),
    })),
  },
]);

function isTestFile(repoPath) {
  return (
    repoPath.includes('/__tests__/') ||
    repoPath.endsWith('.test.js') ||
    repoPath.endsWith('.test.mjs')
  );
}

function extractUnreleasedChangelog(content) {
  const source = typeof content === 'string' ? content : '';
  const heading = /^## \[Unreleased\]\s*$/m.exec(source);

  if (!heading) {
    return '';
  }

  const sectionStart = heading.index + heading[0].length;
  const remainingContent = source.slice(sectionStart);
  const nextRelease = /^## \[/m.exec(remainingContent);
  const sectionEnd = nextRelease
    ? sectionStart + nextRelease.index
    : source.length;

  return retainLineNumbers(source, sectionStart, sectionEnd);
}

function extractCurrentReleaseNotes(content) {
  const source = typeof content === 'string' ? content : '';
  const heading = /^##\s+.+$/m.exec(source);

  if (!heading) {
    return '';
  }

  const remainingContent = source.slice(heading.index + heading[0].length);
  const nextRelease = /^##\s+.+$/m.exec(remainingContent);
  const sectionEnd = nextRelease
    ? heading.index + heading[0].length + nextRelease.index
    : source.length;

  return retainLineNumbers(source, heading.index, sectionEnd);
}

function retainLineNumbers(content, sectionStart, sectionEnd) {
  return content
    .split('')
    .map((character, index) => (
      index >= sectionStart && index < sectionEnd
        ? character
        : character === '\n'
          ? '\n'
          : ''
    ))
    .join('');
}

function loadProductLanguageSurface({ rootDir, definition }) {
  const files = collectRepositoryTextFiles({
    rootDir,
    includedRoots: definition.includedRoots,
  });
  const includedFiles = definition.shouldIncludeFile
    ? files.filter(definition.shouldIncludeFile)
    : files;

  return {
    surfaceId: definition.surfaceId,
    files: definition.mapFiles
      ? definition.mapFiles(includedFiles)
      : includedFiles,
  };
}

function buildPolicyProductLanguageRepositoryAudit({
  rootDir = process.cwd(),
  generatedAt,
} = {}) {
  const surfaces = PRODUCT_LANGUAGE_SURFACE_DEFINITIONS.map(definition =>
    loadProductLanguageSurface({ rootDir, definition })
  );
  const audit = buildPolicyProductLanguageAudit({ surfaces, generatedAt });

  return {
    ...audit,
    scanScope: 'operator_and_runtime_surfaces',
    sideEffects: {
      ...audit.sideEffects,
      filesRead: true,
    },
  };
}

export {
  PRODUCT_LANGUAGE_SURFACE_DEFINITIONS,
  buildPolicyProductLanguageRepositoryAudit,
  extractCurrentReleaseNotes,
  extractUnreleasedChangelog,
  isTestFile,
  loadProductLanguageSurface,
};
