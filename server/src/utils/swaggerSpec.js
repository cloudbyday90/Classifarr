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

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Strips JSDoc comment markers and leading ' * ' from each line.
 * @param {string} commentBody - Content between /** and *\/
 * @returns {string[]}
 */
function stripCommentLines(commentBody) {
  return commentBody.split('\n').map((line) => line.replace(/^\s*\* ?/, ''));
}

/**
 * Attempts to parse a YAML string and push the result into an array.
 * Silently ignores invalid YAML.
 * @param {string} yamlStr
 * @param {object[]} blocks
 */
function parseAndPush(yamlStr, blocks) {
  try {
    const parsed = yaml.load(yamlStr);
    if (parsed && typeof parsed === 'object') {
      blocks.push(parsed);
    }
  } catch (_) {
    // Ignore malformed YAML blocks — same behaviour as swagger-jsdoc
  }
}

/**
 * Extracts all @swagger / @openapi YAML blocks from a JS file's JSDoc comments.
 * @param {string} fileContent
 * @returns {object[]} Parsed YAML objects
 */
function extractSwaggerBlocks(fileContent) {
  const commentRe = /\/\*\*([\s\S]*?)\*\//g;
  const blocks = [];
  let match;

  while ((match = commentRe.exec(fileContent)) !== null) {
    const commentBody = match[1];
    if (!/@swagger|@openapi/.test(commentBody)) continue;

    const lines = stripCommentLines(commentBody);

    let collecting = false;
    let yamlLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '@swagger' || trimmed === '@openapi') {
        if (collecting && yamlLines.length > 0) {
          parseAndPush(yamlLines.join('\n'), blocks);
          yamlLines = [];
        }
        collecting = true;
      } else if (collecting) {
        // A new @tag ends the current swagger block
        if (/^@\w/.test(trimmed)) {
          parseAndPush(yamlLines.join('\n'), blocks);
          yamlLines = [];
          collecting = false;
        } else {
          yamlLines.push(line);
        }
      }
    }

    if (collecting && yamlLines.length > 0) {
      parseAndPush(yamlLines.join('\n'), blocks);
    }
  }

  return blocks;
}

/**
 * Recursively merges source into target in-place.
 * Objects are merged recursively; arrays are concatenated; scalar values overwrite.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source || {})) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
      target[key] =
        tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal)
          ? deepMerge(tgtVal, srcVal)
          : deepMerge({}, srcVal);
    } else if (Array.isArray(srcVal)) {
      target[key] = Array.isArray(tgtVal)
        ? tgtVal.concat(srcVal)
        : [...srcVal];
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}

// Well-known top-level OpenAPI keys that should be merged directly into the spec.
const OPENAPI_TOP_LEVEL_KEYS = new Set([
  'components',
  'consumes',
  'definitions',
  'info',
  'parameters',
  'paths',
  'produces',
  'responses',
  'schemas',
  'securityDefinitions',
  'servers',
  'tags',
]);

/**
 * Organizes a parsed @swagger annotation block into the spec object.
 * Mirrors swagger-jsdoc's `organize()` routing logic:
 *   - Keys starting with '/'       → spec.paths[key]
 *   - 'x-webhooks'                 → spec['x-webhooks']
 *   - Well-known top-level keys    → merged directly
 *   - extension keys (x-*)         → ignored (vendor-specific placement varies)
 *
 * @param {object} spec - The spec being built (mutated in place)
 * @param {object} block - Parsed annotation object
 */
function organizeBlock(spec, block) {
  for (const key of Object.keys(block || {})) {
    if (key === 'x-webhooks') {
      spec['x-webhooks'] = deepMerge(spec['x-webhooks'] || {}, block[key]);
    } else if (key.startsWith('/')) {
      // Bare path — belongs in spec.paths
      spec.paths[key] = deepMerge(spec.paths[key] || {}, block[key]);
    } else if (OPENAPI_TOP_LEVEL_KEYS.has(key)) {
      const blockVal = block[key];
      if (Array.isArray(blockVal)) {
        // Arrays (e.g. tags, servers) must be concatenated, not index-merged
        spec[key] = Array.isArray(spec[key]) ? spec[key].concat(blockVal) : [...blockVal];
      } else {
        spec[key] = deepMerge(spec[key] || {}, blockVal);
      }
    }
    // other keys (x-*, unrecognised) are skipped
  }
}

/**
 * Resolves an apis pattern to a list of absolute file paths.
 * Supports simple glob patterns ending in *.ext (single directory wildcard only).
 * More complex globs are not needed for this project's usage.
 * @param {string} pattern
 * @returns {string[]}
 */
function resolvePattern(pattern) {
  const resolved = path.resolve(process.cwd(), pattern);

  if (!resolved.includes('*')) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync(resolved) ? [resolved] : [];
  }

  const dir = path.dirname(resolved);
  const basename = path.basename(resolved); // e.g. "*.js"
  const extFilter = basename.startsWith('*') ? basename.slice(1) : null; // e.g. ".js"

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const entries = fs.readdirSync(dir);
    return entries
      .filter((f) => !extFilter || f.endsWith(extFilter))
      .map((f) => path.join(dir, f));
  } catch (_) {
    return [];
  }
}

/**
 * Generates an OpenAPI 3.0 spec object from JSDoc @swagger and @openapi
 * annotations in route files.
 *
 * Accepts the same options object as swagger-jsdoc:
 *   {
 *     definition: { openapi: '3.0.0', info: { ... }, servers: [ ... ] },
 *     apis: ['./src/routes/*.js'],
 *   }
 *
 * This function intentionally does NOT use @apidevtools/swagger-parser, which
 * would trigger the Node.js 24+ DEP0169 url.parse() deprecation warning via
 * its @apidevtools/json-schema-ref-parser dependency.
 *
 * @param {object} options
 * @returns {object} OpenAPI spec
 */
function generateSpec(options) {
  const { definition, apis = [] } = options;

  // Deep-copy the definition to avoid mutating the caller's object
  const spec = JSON.parse(JSON.stringify(definition));
  spec.paths = spec.paths || {};
  spec.components = spec.components || {};
  spec.tags = spec.tags || [];

  // Collect all file paths from the provided patterns
  const filePaths = apis.flatMap(resolvePattern);

  // Merge each file's @swagger/@openapi blocks into the spec
  for (const filePath of filePaths) {
    let content;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      content = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      continue;
    }

    for (const block of extractSwaggerBlocks(content)) {
      organizeBlock(spec, block);
    }
  }

  // Remove empty placeholder objects that would fail OpenAPI validation
  for (const prop of [
    'definitions',
    'responses',
    'parameters',
    'securityDefinitions',
  ]) {
    if (spec[prop] && Object.keys(spec[prop]).length === 0) {
      delete spec[prop];
    }
  }

  return spec;
}

module.exports = generateSpec;
