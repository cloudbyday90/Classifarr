/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const fs = require('fs');
const path = require('path');
const {
  lintRagApiDocs,
  extractCanonicalEndpoints,
  readRagRouteContent
} = require('../check-rag-api-docs');

describe('check-rag-api-docs', () => {
  const docPath = path.join(__dirname, '../../docs/api/README.md');
  const docContent = fs.readFileSync(docPath, 'utf8');
  const routeContent = readRagRouteContent();

  it('passes against the current repo files', () => {
    const result = lintRagApiDocs({ docContent, routeContent });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('extracts canonical endpoints from the API README', () => {
    const endpoints = extractCanonicalEndpoints(docContent);
    expect(endpoints).toContain('POST /api/rag/text-models');
    expect(endpoints).toContain('POST /api/rag/image-models-metadata');
    expect(endpoints).toContain('GET /api/rag/backfill/config');
  });

  it('fails when a required canonical endpoint is missing', () => {
    const brokenDocContent = docContent.replace(
      '- `POST /api/rag/text-models` — canonical text model metadata endpoint\n',
      ''
    );

    const result = lintRagApiDocs({ docContent: brokenDocContent, routeContent });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Missing canonical endpoint in docs/api/README.md: POST /api/rag/text-models'
    );
  });
});
