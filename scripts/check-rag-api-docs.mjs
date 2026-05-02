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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOC_PATH = path.join(__dirname, '../docs/api/README.md');
const RAG_ROUTE_GLOB = path.join(__dirname, '../server/src/routes/{rag.js,helpers/rag*.js}');

const REQUIRED_CANONICAL_ENDPOINTS = [
  'GET /api/rag/status',
  'GET /api/rag/backfill/status',
  'GET /api/rag/backfill/config',
  'PUT /api/rag/backfill/config',
  'POST /api/rag/text-models',
  'POST /api/rag/test-connection',
  'POST /api/rag/image-models-metadata',
  'POST /api/rag/image-test-connection',
  'POST /api/rag/reembed-images',
  'POST /api/rag/backfill/manual/start',
  'POST /api/rag/backfill/manual/pause',
  'POST /api/rag/backfill/manual/resume',
  'POST /api/rag/backfill/manual/clear'
];

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function extractCanonicalEndpoints(docContent) {
  const sectionMatch = docContent.match(
    /## Canonical RAG & Embeddings Endpoints([\s\S]*?)---/
  );

  if (!sectionMatch) {
    throw new Error('Missing "## Canonical RAG & Embeddings Endpoints" section in docs/api/README.md');
  }

  return sectionMatch[1]
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('- `') && line.includes('`'))
    .map(line => {
      const match = line.match(/^- `([^`]+)`/);
      return match ? normalizeWhitespace(match[1]) : null;
    })
    .filter(Boolean);
}

function extractDeclaredRoutes(routeContent) {
  const routes = new Set();
  const routeRegex = /router\.(get|post|put|patch|delete)\('([^']+)'/g;
  let match = routeRegex.exec(routeContent);

  while (match) {
    routes.add(`${match[1].toUpperCase()} /api/rag${match[2]}`);
    match = routeRegex.exec(routeContent);
  }

  return routes;
}

function readRagRouteContent() {
  return globSync(RAG_ROUTE_GLOB, { windowsPathsNoEscape: true })
    .map(filePath => fs.readFileSync(filePath, 'utf8'))
    .join('\n');
}

function lintRagApiDocs({ docContent, routeContent } = {}) {
  const effectiveDocContent = docContent ?? fs.readFileSync(DOC_PATH, 'utf8');
  const effectiveRouteContent = routeContent ?? readRagRouteContent();

  const errors = [];
  const documentedCanonicalEndpoints = new Set(extractCanonicalEndpoints(effectiveDocContent));
  const declaredRoutes = extractDeclaredRoutes(effectiveRouteContent);

  for (const endpoint of REQUIRED_CANONICAL_ENDPOINTS) {
    if (!documentedCanonicalEndpoints.has(endpoint)) {
      errors.push(`Missing canonical endpoint in docs/api/README.md: ${endpoint}`);
    }
    if (!declaredRoutes.has(endpoint)) {
      errors.push(`Documented canonical endpoint is not declared in the RAG route modules: ${endpoint}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function main() {
  const result = lintRagApiDocs();
  if (!result.valid) {
    console.error('RAG API docs lint failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('RAG API docs lint passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export {
  extractCanonicalEndpoints,
  extractDeclaredRoutes,
  readRagRouteContent,
  lintRagApiDocs
};