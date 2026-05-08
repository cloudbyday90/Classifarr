/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'node:fs';
import path from 'node:path';

const VALID_METHODS = [
  'existing_media',
  'manual_correction',
  'manual_classification',
  'exact_match',
  'learned_pattern',
  'source_library',
  'policy_auto',
  'policy_prompt',
  'policy_recheck',
  'ai_verified',
  'ai_analysis',
  'ai_rerun',
  'signal_calculation',
  'fallback',
  'queued_for_retry',
  'custom_rule',
  'rule_match',
  'ai_fallback',
  'holiday_detection',
  'library_rule',
  'rag_improved',
  'authoritative_source_library',
  'policy_engine'
];

function getAllJsFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Classification Methods Constraint', () => {
  test('all method values in service code are in VALID_METHODS list', () => {
    const servicesDir = path.join(import.meta.dirname, '..', 'services');
    const files = getAllJsFiles(servicesDir);
    
    const foundMethods = new Set();
    const methodPattern = /method:\s*['"]([^'"]+)['"]/g;
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = methodPattern.exec(content)) !== null) {
        foundMethods.add(match[1]);
      }
    }
    
    const invalidMethods = [...foundMethods].filter(m => !VALID_METHODS.includes(m));
    
    if (invalidMethods.length > 0) {
      console.error('Invalid methods found in code:', invalidMethods);
      console.error('\nEither add these to VALID_METHODS in this test AND create a migration to update the database constraint,');
      console.error('or fix the code to use a valid method.');
    }
    
    expect(invalidMethods).toEqual([]);
  });
});
