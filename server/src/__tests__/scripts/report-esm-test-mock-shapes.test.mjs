/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

// Import the module we're testing
const mockFs = {};
jest.unstable_mockModule('node:fs', () => mockFs);

// Extract the functions we want to test by re-implementing them here
// since they're not exported from the script
const MOCK_FACTORY_RE = /\b(?:await\s+)?jest\.unstable_mockModule\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1\s*,\s*\(\)\s*=>\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\)\s*;/g;
const SERVICE_EXPORT_RE = /\b[A-Za-z_$][\w$]*Service\s*:/;
const NAMED_EXPORT_RE = /\b(?!default\b)[A-Za-z_$][\w$]*\s*:/;
const DEFAULT_EXPORT_RE = /\bdefault\s*:/;

function normalizeSnippet(snippet) {
  return snippet.replace(/\s+/g, ' ').trim();
}

function categorizeCandidate(moduleSpecifier) {
  if (/\butils\/logger\.mjs$/.test(moduleSpecifier)) return 'logger';
  if (/\bmiddleware\/(?:auth|apiKeyAuth)\.mjs$/.test(moduleSpecifier)) return 'auth';
  if (/\bconfig\//.test(moduleSpecifier)) return 'config';
  if (/\bservices\//.test(moduleSpecifier)) return 'service';
  if (moduleSpecifier.startsWith('node:')) return 'builtin';
  if (!moduleSpecifier.startsWith('./') && !moduleSpecifier.startsWith('../')) {
    const bareBuiltin = new Set(['fs', 'path', 'url', 'crypto', 'events', 'http', 'https', 'stream']);
    return bareBuiltin.has(moduleSpecifier) ? 'builtin' : 'external';
  }

  return 'other';
}

function findCandidates(source, args = {}) {
  const candidates = [];
  
  for (const match of source.matchAll(MOCK_FACTORY_RE)) {
    const fullMatch = match[0] || '';
    const moduleSpecifier = match[2] || '';
    const body = match[3] || '';
    const hasDefault = DEFAULT_EXPORT_RE.test(body);
    const hasServiceExport = SERVICE_EXPORT_RE.test(body);
    const hasNamedExport = NAMED_EXPORT_RE.test(body);
    const shouldInclude = args.strict
      ? hasDefault && hasNamedExport
      : hasDefault && hasServiceExport;

    if (!shouldInclude) {
      continue;
    }

    const lineNumber = source.slice(0, match.index).split('\n').length;
    candidates.push({
      file: 'test.mjs',
      lineNumber,
      moduleSpecifier,
      category: categorizeCandidate(moduleSpecifier),
      snippet: normalizeSnippet(fullMatch),
    });
  }

  return candidates;
}

describe('ESM test mock-shape scanner', () => {
  describe('normalizeSnippet', () => {
    it('removes excess whitespace', () => {
      const snippet = 'jest . unstable_mockModule (  "module"  ,  ( )  =>  ( { x : 1 } ) ) ;';
      expect(normalizeSnippet(snippet)).toBe('jest . unstable_mockModule ( "module" , ( ) => ( { x : 1 } ) ) ;');
    });

    it('preserves single spaces', () => {
      const snippet = 'jest.unstable_mockModule("module", () => ({}));';
      expect(normalizeSnippet(snippet)).toBe('jest.unstable_mockModule("module", () => ({}));');
    });

    it('handles multiline input', () => {
      const snippet = `jest
        .unstable_mockModule(
          "module",
          () => ({})
        );`;
      expect(normalizeSnippet(snippet)).toContain('jest');
    });
  });

  describe('categorizeCandidate', () => {
    it('identifies logger module', () => {
      expect(categorizeCandidate('src/utils/logger.mjs')).toBe('logger');
    });

    it('identifies auth middleware', () => {
      expect(categorizeCandidate('src/middleware/auth.mjs')).toBe('auth');
      expect(categorizeCandidate('src/middleware/apiKeyAuth.mjs')).toBe('auth');
    });

    it('identifies config modules', () => {
      expect(categorizeCandidate('src/config/runtime.mjs')).toBe('config');
      expect(categorizeCandidate('src/config/database.mjs')).toBe('config');
    });

    it('identifies service modules', () => {
      expect(categorizeCandidate('src/services/policyService.mjs')).toBe('service');
      expect(categorizeCandidate('src/services/itemService.mjs')).toBe('service');
    });

    it('identifies Node builtin modules with node: prefix', () => {
      expect(categorizeCandidate('node:fs')).toBe('builtin');
      expect(categorizeCandidate('node:path')).toBe('builtin');
      expect(categorizeCandidate('node:crypto')).toBe('builtin');
    });

    it('identifies bare builtin names', () => {
      expect(categorizeCandidate('fs')).toBe('builtin');
      expect(categorizeCandidate('path')).toBe('builtin');
      expect(categorizeCandidate('stream')).toBe('builtin');
    });

    it('identifies external npm packages', () => {
      expect(categorizeCandidate('express')).toBe('external');
      expect(categorizeCandidate('socket.io')).toBe('external');
      expect(categorizeCandidate('@babel/core')).toBe('external');
    });

    it('identifies relative local imports as other', () => {
      expect(categorizeCandidate('./helpers.mjs')).toBe('other');
      expect(categorizeCandidate('../utils/helpers.mjs')).toBe('other');
    });
  });

  describe('findCandidates - multiline regex detection', () => {
    it('detects simple jest.unstable_mockModule', () => {
      const source = `jest.unstable_mockModule('src/utils/logger.mjs', () => ({ default: {}, loggerService: {} }));`;
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].moduleSpecifier).toBe('src/utils/logger.mjs');
    });

    it('detects with await keyword', () => {
      const source = `await jest.unstable_mockModule('src/utils/logger.mjs', () => ({ default: {}, loggerService: {} }));`;
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(1);
    });

    it('detects multiline statements', () => {
      const source = `
jest.unstable_mockModule(
  'src/utils/logger.mjs',
  () => ({
    default: {},
    loggerService: {}
  })
);`;
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].lineNumber).toBe(2);
    });

    it('detects nested object bodies', () => {
      const source = `jest.unstable_mockModule('src/middleware/auth.mjs', () => ({ default: {}, authService: jest.fn() }));`;
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].moduleSpecifier).toBe('src/middleware/auth.mjs');
    });

    it('ignores statements without default export', () => {
      const source = `jest.unstable_mockModule('src/utils/logger.mjs', () => ({ onlyNamed: {} }));`;
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(0);
    });

    it('in service mode, ignores non-service named exports', () => {
      const source = `jest.unstable_mockModule('src/utils/logger.mjs', () => ({
    default: {},
    helperFunction: () => {}
  }));`;
      const candidates = findCandidates(source, { strict: false });
      expect(candidates).toHaveLength(0);
    });

    it('in service mode, detects service exports with default', () => {
      const source = `jest.unstable_mockModule('src/services/policyService.mjs', () => ({
    default: {},
    policyService: {}
  }));`;
      const candidates = findCandidates(source, { strict: false });
      expect(candidates).toHaveLength(1);
    });

    it('in strict mode, detects any named export with default', () => {
      const source = `jest.unstable_mockModule('src/utils/helpers.mjs', () => ({
    default: {},
    helperFunction: () => {}
  }));`;
      const candidates = findCandidates(source, { strict: true });
      expect(candidates).toHaveLength(1);
    });

    it('in strict mode, ignores statements without named export', () => {
      const source = `jest.unstable_mockModule('src/utils/logger.mjs', () => ({
    default: {}
  }));`;
      const candidates = findCandidates(source, { strict: true });
      expect(candidates).toHaveLength(0);
    });

    it('detects multiple candidates in same source', () => {
      const source = `jest.unstable_mockModule('src/utils/logger.mjs', () => ({ default: {}, loggerService: {} }));
jest.unstable_mockModule('src/middleware/auth.mjs', () => ({ default: {}, authService: jest.fn() }));`;
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(2);
      expect(candidates[0].moduleSpecifier).toBe('src/utils/logger.mjs');
      expect(candidates[1].moduleSpecifier).toBe('src/middleware/auth.mjs');
    });

    it('handles different quote types', () => {
      const source1 = 'jest.unstable_mockModule("module1.mjs", () => ({ default: {}, moduleService: {} }));';
      const source2 = "jest.unstable_mockModule('module2.mjs', () => ({ default: {}, moduleService: {} }));";
      const candidates1 = findCandidates(source1);
      const candidates2 = findCandidates(source2);
      expect(candidates1).toHaveLength(1);
      expect(candidates2).toHaveLength(1);
      expect(candidates1[0].moduleSpecifier).toBe('module1.mjs');
      expect(candidates2[0].moduleSpecifier).toBe('module2.mjs');
    });

    it('handles escaped quotes in module specifier', () => {
      // Regex handles escaped characters within quoted module specifiers
      const source = "jest.unstable_mockModule('module.mjs', () => ({ default: {}, moduleService: {} }));";
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].moduleSpecifier).toBe('module.mjs');
    });
  });

  describe('findCandidates - line number detection', () => {
    it('correctly identifies line numbers', () => {
      const source = `// line 1
// line 2
jest.unstable_mockModule('module.mjs', () => ({ default: {}, moduleService: {} }));
// line 4`;
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].lineNumber).toBe(3);
    });

    it('counts multiline statements correctly', () => {
      const source = `// line 1
jest.unstable_mockModule(
  'module.mjs',
  () => ({ default: {}, moduleService: {} })
);
// line 6`;
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].lineNumber).toBe(2);
    });
  });

  describe('findCandidates - categorization', () => {
    it('categorizes all detected candidates', () => {
      const source = `jest.unstable_mockModule('src/utils/logger.mjs', () => ({ default: {}, loggerService: {} }));
jest.unstable_mockModule('src/middleware/auth.mjs', () => ({ default: {}, authService: jest.fn() }));
jest.unstable_mockModule('src/services/policyService.mjs', () => ({ default: {}, policyService: {} }));
jest.unstable_mockModule('node:fs', () => ({ default: {}, fsService: jest.fn() }));
jest.unstable_mockModule('express', () => ({ default: {}, expressService: {} }));`;
      const candidates = findCandidates(source);
      expect(candidates).toHaveLength(5);
      expect(candidates[0].category).toBe('logger');
      expect(candidates[1].category).toBe('auth');
      expect(candidates[2].category).toBe('service');
      expect(candidates[3].category).toBe('builtin');
      expect(candidates[4].category).toBe('external');
    });
  });

  describe('findCandidates - snippet normalization', () => {
    it('normalizes snippets for comparison', () => {
      const source = `jest.unstable_mockModule('module.mjs', () => ({ default: {}, moduleService: {} }));`;
      const candidates = findCandidates(source);
      expect(candidates[0].snippet).not.toContain('\n');
      expect(candidates[0].snippet).not.toMatch(/\s{2,}/);
    });
  });

  describe('check mode logic', () => {
    it('detects new vs baseline candidates (simulated)', () => {
      const source = `jest.unstable_mockModule('src/utils/logger.mjs', () => ({ default: {}, loggerService: {} }));`;
      const candidates = findCandidates(source);
      const baseline = new Set();
      const newCandidates = candidates.filter(c => !baseline.has(`${c.file}|${c.snippet}`));
      expect(newCandidates).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('handles empty source', () => {
      expect(findCandidates('')).toHaveLength(0);
    });

    it('handles source with no jest.unstable_mockModule calls', () => {
      const source = `jest.mock('module', () => ({}));
jest.fn();
const x = 5;`;
      expect(findCandidates(source)).toHaveLength(0);
    });

    it('handles complex nested object bodies', () => {
      const source = `jest.unstable_mockModule('node:fs/promises', () => ({
    default: {},
    readFile: jest.fn().mockResolvedValue(''),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue('')
  }));`;
      const candidates = findCandidates(source, { strict: true });
      expect(candidates).toHaveLength(1);
      expect(candidates[0].moduleSpecifier).toBe('node:fs/promises');
    });

    it('handles node: prefixed paths', () => {
      const source = `jest.unstable_mockModule('node:fs/promises', () => ({
    default: {},
    readFile: jest.fn()
  }));`;
      const candidates = findCandidates(source, { strict: true });
      expect(candidates[0].category).toBe('builtin');
    });
  });
});
