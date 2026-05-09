/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * fix-custom-mock-factories.mjs
 *
 * Fixes test files where `jest.unstable_mockModule(path, () => ({...}))`
 * uses a custom factory (not createMockModule/createNamedMockModule) that
 * doesn't expose the named singleton export key.
 *
 * For each matching `jest.unstable_mockModule` call:
 *  - If the factory has `default: X`, inserts `serviceName: X,` before it
 *  - If the factory has no `default:`, inserts `serviceName: {...spread...},` before the first key
 *
 * This ensures Jest's static link check passes for `import { serviceName }`.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, basename } from 'path';

const SCRIPT_DIR = import.meta.dirname;
const ROOT = resolve(SCRIPT_DIR, '..');
const SERVER_SRC = join(ROOT, 'server', 'src');
const TESTS_DIR = join(SERVER_SRC, '__tests__');

// ---------------------------------------------------------------------------
// Export name map: service basename → singleton export name
// ---------------------------------------------------------------------------
const SERVICE_MAP = new Map([
  ['backupService', 'backupService'],
  ['clarificationService', 'clarificationService'],
  ['classificationRagLoopService', 'classificationRagLoopService'],
  ['classificationRetryService', 'classificationRetryService'],
  ['confidenceCalculator', 'confidenceCalculator'],
  ['contentTypeAnalyzer', 'contentTypeAnalyzer'],
  ['feedbackAnalysis', 'feedbackAnalysis'],
  ['idleBackfillService', 'idleBackfillService'],
  ['scheduledBackfillService', 'scheduledBackfillService'],
  ['manualBackfillService', 'manualBackfillService'],
  ['libraryMappingService', 'libraryMappingService'],
  ['libraryProfileService', 'libraryProfileService'],
  ['ollamaService', 'ollamaService'],
  ['ollama', 'ollamaService'],
  ['policyQuestionBuilder', 'policyQuestionBuilder'],
  ['queueService', 'queueService'],
  ['reclassificationBatchService', 'reclassificationBatchService'],
  ['schedulerService', 'schedulerService'],
  ['syncStatus', 'syncStatus'],
  ['ragRetriever', 'ragRetriever'],
  ['tmdb', 'tmdbService'],
  ['tavily', 'tavilyService'],
  ['cloudLLM', 'cloudLLMService'],
  ['discordBot', 'discordBotService'],
  ['policyEngine', 'policyEngine'],
  ['embeddingService', 'embeddingService'],
  ['radarr', 'radarrService'],
  ['sonarr', 'sonarrService'],
  ['webhook', 'webhookService'],
  ['enrichmentRetryService', 'enrichmentRetryService'],
  ['fileOperationsService', 'fileOperationsService'],
  ['startupService', 'startupService'],
  ['aiRouter', 'aiRouterService'],
  ['legacyMigration', 'legacyMigrationService'],
  ['plexOAuth', 'plexOAuthService'],
  ['embyAuth', 'embyAuthService'],
  ['jellyfinAuth', 'jellyfinAuthService'],
  ['ragLoopHelpers', 'ragLoopHelpers'],
  ['patternMiningService', 'patternMiningService'],
  ['reclassificationService', 'reclassificationService'],
  ['healthCheckService', 'healthCheckService'],
  ['scheduler', 'schedulerService'],
  ['queueOmdbEnrichmentService', 'queueOmdbEnrichmentService'],
  ['ragLogger', 'ragLogger'],
  ['mediaSync', 'mediaSyncService'],
  ['omdb', 'omdbService'],
  ['embeddingMigrationService', 'embeddingMigrationService'],
  ['classificationAiService', 'classificationAiService'],
  ['classificationMetadataService', 'classificationMetadataService'],
  ['classificationPersistenceService', 'classificationPersistenceService'],
  ['classificationRoutingService', 'classificationRoutingService'],
  ['signalCollector', 'signalCollector'],
  ['patternSignalCollector', 'patternSignalCollector'],
  ['patternReinforcementService', 'patternReinforcementService'],
]);

// Routes that export router
const ROUTE_MAP = new Set([
  'apiKeys', 'api', 'webhook', 'sync', 'backup', 'classification',
  'clarification', 'libraries', 'policies', 'queue', 'rag', 'settings',
  'reclassification', 'feedback', 'scheduler', 'requests', 'prompts',
  'mappings', 'confidence', 'user', 'health', 'embyAuth', 'jellyfinAuth',
  'plexOAuth', 'setup', 'migration', 'radarr', 'sonarr',
]);

function getExportNameForPath(importPath) {
  const base = basename(importPath, '.mjs');
  if (SERVICE_MAP.has(base)) return SERVICE_MAP.get(base);
  if (ROUTE_MAP.has(base)) return 'router';
  return null;
}

// ---------------------------------------------------------------------------
// Fix a single test file
// ---------------------------------------------------------------------------
function fixFile(filePath) {
  let src = readFileSync(filePath, 'utf8');
  const original = src;

  // Match single-line: jest.unstable_mockModule('path', () => ({ ... }))
  // where the factory doesn't use createMockModule/createNamedMockModule
  // and the returned object starts with `default:` or doesn't have the serviceName key
  //
  // Pattern: jest.unstable_mockModule('path.mjs', () => ({ default: X }));
  // Single-line version
  src = src.replace(
    /jest\.unstable_mockModule\((['"`])([^'"`)]+\.mjs)\1,\s*\(\)\s*=>\s*\(\{\s*default:\s*([\S][^)]*)\}\)\);/g,
    (match, quote, importPath, defaultVal) => {
      const serviceName = getExportNameForPath(importPath);
      if (!serviceName) return match;
      // Check if serviceName is already present
      if (match.includes(`${serviceName}:`)) return match;
      return `jest.unstable_mockModule(${quote}${importPath}${quote}, () => ({ ${serviceName}: ${defaultVal.trim()}, default: ${defaultVal.trim()} }));`;
    }
  );

  // Multi-line factory: add serviceName key after the opening brace
  // Pattern: the line contains jest.unstable_mockModule('path.mjs', () => ({
  // and subsequent lines have default: X or individual method mocks
  // Strategy: find the opening line, check if serviceName is not already there,
  // then find the `default:` key on some line and insert `serviceName: X,` before it
  const lines = src.split('\n');
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Detect start of a jest.unstable_mockModule(..., () => ({ ... multi-line factory
    const mockMatch = line.match(/jest\.unstable_mockModule\((['"`])([^'"`)]+\.mjs)\1,\s*(\(?)\s*\(\)\s*=>\s*\(\{/);
    if (mockMatch && !line.includes('createMockModule') && !line.includes('createNamedMockModule')) {
      const importPath = mockMatch[2];
      const serviceName = getExportNameForPath(importPath);

      // Collect the full factory block (scan until matching closing }));)
      const startLine = i;
      const blockLines = [line];
      let braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      i++;
      while (i < lines.length && braceDepth > 0) {
        const l = lines[i];
        blockLines.push(l);
        braceDepth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
        i++;
      }
      // blockLines is the full mock block

      if (serviceName) {
        const blockStr = blockLines.join('\n');
        // Check if serviceName already in block
        if (!blockStr.includes(`${serviceName}:`)) {
          // Find the line with `default:` inside and insert serviceName before it
          let inserted = false;
          for (let j = 1; j < blockLines.length; j++) {
            if (blockLines[j].trim().startsWith('default:')) {
              // Get the indentation
              const indent = blockLines[j].match(/^(\s*)/)[1];
              const defaultRhs = blockLines[j].trim().replace(/^default:\s*/, '').replace(/,$/, '');
              blockLines.splice(j, 0, `${indent}${serviceName}: ${defaultRhs},`);
              inserted = true;
              break;
            }
          }
          // If no `default:` found, add serviceName as an empty object or skip
          if (!inserted) {
            // Insert after the opening `({` line
            const indent = '  ';
            blockLines.splice(1, 0, `${indent}${serviceName}: {},`);
          }
        }
      }
      result.push(...blockLines);
    } else {
      result.push(line);
      i++;
    }
  }
  src = result.join('\n');

  if (src !== original) {
    writeFileSync(filePath, src, 'utf8');
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Walk test files
// ---------------------------------------------------------------------------
function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return []; }
  const result = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) result.push(...walk(full));
    else if (entry.endsWith('.test.mjs') || entry.endsWith('.test.js') || full.includes('/setup/') || full.includes('/helpers/')) {
      result.push(full);
    }
  }
  return result;
}

let total = 0;
for (const f of walk(TESTS_DIR)) {
  if (fixFile(f)) {
    total++;
    console.log(`  fixed: ${f.replace(ROOT + '\\', '').replace(/\\/g, '/')}`);
  }
}
console.log(`\nDone: ${total} files updated.`);
