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
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const __dirname = import.meta.dirname;

describe('check-rag-api-docs', () => {
  const docPath = path.join(__dirname, '../../docs/api/README.md');
  const docContent = fs.readFileSync(docPath, 'utf8');
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'check-rag-api-docs.mjs')).href;

  function runModule(script, payload) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-docs-test-'));
    const payloadPath = path.join(tempDir, 'payload.json');

    try {
      fs.writeFileSync(payloadPath, JSON.stringify(payload), 'utf8');
      const output = execFileSync(
        'node',
        ['--input-type=module', '-e', script],
        { encoding: 'utf8' }
      );
      return JSON.parse(output);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  function lintRagApiDocs(payload) {
    return runModule(
      `import fs from 'node:fs';
import { lintRagApiDocs } from ${JSON.stringify(moduleUrl)};
const payload = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(os.tmpdir(), 'unused'))}.replace('unused', 'payload.json'), 'utf8'));`,
      payload
    );
  }

  function invokeExport(exportName, argName, argValue) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-docs-test-'));
    const payloadPath = path.join(tempDir, 'payload.json');

    try {
      fs.writeFileSync(payloadPath, JSON.stringify({ [argName]: argValue }), 'utf8');
      const script = `import fs from 'node:fs';
import { ${exportName} } from ${JSON.stringify(moduleUrl)};
const payload = JSON.parse(fs.readFileSync(${JSON.stringify(payloadPath)}, 'utf8'));
const result = ${exportName}(payload[${JSON.stringify(argName)}]);
process.stdout.write(JSON.stringify(result));`;
      return JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  function readRagRouteContent() {
    const script = `import { readRagRouteContent } from ${JSON.stringify(moduleUrl)};
process.stdout.write(JSON.stringify(readRagRouteContent()));`;
    return JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }));
  }

  const routeContent = readRagRouteContent();

  it('passes against the current repo files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-docs-test-'));
    const payloadPath = path.join(tempDir, 'payload.json');

    try {
      fs.writeFileSync(payloadPath, JSON.stringify({ docContent, routeContent }), 'utf8');
      const script = `import fs from 'node:fs';
import { lintRagApiDocs } from ${JSON.stringify(moduleUrl)};
const payload = JSON.parse(fs.readFileSync(${JSON.stringify(payloadPath)}, 'utf8'));
process.stdout.write(JSON.stringify(lintRagApiDocs(payload)));`;
      const result = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }));
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('extracts canonical endpoints from the API README', () => {
    const endpoints = invokeExport('extractCanonicalEndpoints', 'docContent', docContent);
    expect(endpoints).toContain('POST /api/rag/text-models');
    expect(endpoints).toContain('POST /api/rag/image-models-metadata');
    expect(endpoints).toContain('GET /api/rag/backfill/config');
  });

  it('fails when a required canonical endpoint is missing', () => {
    const brokenDocContent = docContent.replace(
      '- `POST /api/rag/text-models` — canonical text model metadata endpoint\n',
      ''
    );

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-docs-test-'));
    const payloadPath = path.join(tempDir, 'payload.json');

    let result;
    try {
      fs.writeFileSync(payloadPath, JSON.stringify({ docContent: brokenDocContent, routeContent }), 'utf8');
      const script = `import fs from 'node:fs';
import { lintRagApiDocs } from ${JSON.stringify(moduleUrl)};
const payload = JSON.parse(fs.readFileSync(${JSON.stringify(payloadPath)}, 'utf8'));
process.stdout.write(JSON.stringify(lintRagApiDocs(payload)));`;
      result = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Missing canonical endpoint in docs/api/README.md: POST /api/rag/text-models'
    );
  });
});
