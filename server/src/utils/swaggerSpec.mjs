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

/* eslint-disable security/detect-non-literal-fs-filename -- paths come from trusted internal config, not user input */
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

function stripCommentLines(commentBody) {
  return commentBody.split('\n').map((line) => line.replace(/^\s*\* ?/, ''));
}

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

function extractSwaggerBlocks(fileContent) {
  const commentRe = /\/\*\*([\s\S]*?)\*\//g;
  const blocks = [];
  let match;

  while ((match = commentRe.exec(fileContent)) !== null) {
    const commentBody = match[1];
    if (!/@swagger|@openapi/.test(commentBody)) {
      continue;
    }

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

function organizeBlock(spec, block) {
  for (const key of Object.keys(block || {})) {
    if (key === 'x-webhooks') {
      spec['x-webhooks'] = deepMerge(spec['x-webhooks'] || {}, block[key]);
    } else if (key.startsWith('/')) {
      spec.paths[key] = deepMerge(spec.paths[key] || {}, block[key]);
    } else if (OPENAPI_TOP_LEVEL_KEYS.has(key)) {
      const blockVal = block[key];
      if (Array.isArray(blockVal)) {
        spec[key] = Array.isArray(spec[key]) ? spec[key].concat(blockVal) : [...blockVal];
      } else {
        spec[key] = deepMerge(spec[key] || {}, blockVal);
      }
    }
  }
}

async function resolvePattern(pattern) {
  const resolved = path.resolve(process.cwd(), pattern);

  if (!resolved.includes('*')) {
    try {
      await access(resolved);
      return [resolved];
    } catch {
      return [];
    }
  }

  const dir = path.dirname(resolved);
  const basename = path.basename(resolved);
  const extFilter = basename.startsWith('*') ? basename.slice(1) : null;

  try {
    const entries = await readdir(dir);
    return entries
      .filter((fileName) => !extFilter || fileName.endsWith(extFilter))
      .map((fileName) => path.join(dir, fileName));
  } catch {
    return [];
  }
}

export async function generateSpec(options) {
  const { definition, apis = [] } = options;

  const spec = JSON.parse(JSON.stringify(definition));
  spec.paths = spec.paths || {};
  spec.components = spec.components || {};
  spec.tags = spec.tags || [];

  const resolvedPatterns = await Promise.all(apis.map(resolvePattern));
  const filePaths = resolvedPatterns.flat();

  for (const filePath of filePaths) {
    let content;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    for (const block of extractSwaggerBlocks(content)) {
      organizeBlock(spec, block);
    }
  }

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
