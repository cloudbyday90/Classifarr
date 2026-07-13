#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildPolicyProductionNamingRepositoryInventory,
} from './lib/policyProductionNamingRepositoryScan.mjs';

function parseArgs(argv) {
  const options = {
    rootDir: process.cwd(),
    outputPath: null,
    requireValid: false,
  };

  argv.forEach((arg, index) => {
    if (arg === '--root') {
      options.rootDir = argv[index + 1] || options.rootDir;
    }

    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
    }

    if (arg === '--require-valid') {
      options.requireValid = true;
    }
  });

  return options;
}

function writeJsonFile(outputPath, payload) {
  if (!outputPath) {
    return;
  }

  const resolvedPath = path.resolve(outputPath);
  mkdirSync(path.dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(options.rootDir);
  const inventory = buildPolicyProductionNamingRepositoryInventory({
    rootDir,
    generatedAt: new Date().toISOString(),
  });

  writeJsonFile(options.outputPath, inventory);
  console.log(JSON.stringify({
    validation: inventory.validation,
    summary: inventory.summary,
    outputPath: options.outputPath,
  }, null, 2));

  if (options.requireValid && inventory.validation.ok !== true) {
    process.exit(1);
  }
}

main();
