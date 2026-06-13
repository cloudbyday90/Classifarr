#!/usr/bin/env node
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
import { resolve } from 'node:path';
import {
  formatPostgresConfigIncludeDiagnostics,
  normalizeDynamicLibraryPathText,
  rewritePgStatStatementsConfigText,
} from './postgres-config-file.mjs';

function updateFile(filePath, transform, fileSystem = fs) {
  const existing = fileSystem.readFileSync(filePath, 'utf8');
  const transformed = transform(existing);
  const next = transformed.endsWith('\n') ? transformed : `${transformed}\n`;
  fileSystem.writeFileSync(filePath, next);
}

export function runPostgresConfigCommand(args, fileSystem = fs) {
  const [command, ...rest] = args;

  if (command === 'rewrite-pgss') {
    const [configPath, enableValue, appendIfMissingValue = enableValue] = rest;
    if (!configPath || !enableValue) {
      throw new Error(
        'Usage: postgres-config-file-cli.mjs rewrite-pgss <configPath> <true|false> [appendIfMissing]'
      );
    }

    updateFile(
      configPath,
      text =>
        rewritePgStatStatementsConfigText(text, {
          enablePgss: enableValue === 'true',
          appendIfMissing: appendIfMissingValue === 'true',
        }),
      fileSystem
    );
    return;
  }

  if (command === 'normalize-dynamic-library-path') {
    const [configPath, stagingPath = ''] = rest;
    if (!configPath) {
      throw new Error(
        'Usage: postgres-config-file-cli.mjs normalize-dynamic-library-path <configPath> [stagingPath]'
      );
    }

    updateFile(
      configPath,
      text => normalizeDynamicLibraryPathText(text, { stagingPath }),
      fileSystem
    );
    return;
  }

  if (command === 'print-includes') {
    const [configPath, label = configPath] = rest;
    if (!configPath) {
      throw new Error(
        'Usage: postgres-config-file-cli.mjs print-includes <configPath> [label]'
      );
    }

    const text = fileSystem.readFileSync(configPath, 'utf8');
    const diagnostics = formatPostgresConfigIncludeDiagnostics(text, label);
    if (diagnostics) {
      console.log(diagnostics);
    }
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function main() {
  try {
    runPostgresConfigCommand(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
