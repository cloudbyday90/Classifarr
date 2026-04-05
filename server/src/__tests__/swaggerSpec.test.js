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

/**
 * swaggerSpec.js regression & unit tests
 *
 * These tests cover the local swagger-jsdoc replacement introduced to
 * eliminate the Node.js 24+ DEP0169 url.parse() deprecation warning
 * previously triggered by @apidevtools/json-schema-ref-parser (a transitive
 * dependency of swagger-jsdoc).
 *
 * All internal helpers (extractSwaggerBlocks, deepMerge, organizeBlock,
 * resolvePattern) are exercised indirectly through the exported generateSpec()
 * function using temporary files so no production source needs to expose
 * private symbols for testing.
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const generateSpec = require('../utils/swaggerSpec');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a temp .js file with given content and returns its absolute path. */
function tmpFile(content) {
  const name = `classifarr_swagger_test_${Date.now()}_${Math.random().toString(36).slice(2)}.js`;
  const filePath = path.join(os.tmpdir(), name);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/** Creates a temp directory and returns its absolute path. */
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr_swagger_'));
}

const BASE_DEF = {
  openapi: '3.0.0',
  info: { title: 'Test', version: '0.0.1' },
};

// ---------------------------------------------------------------------------
// 1. DEP0169 regression guard
// ---------------------------------------------------------------------------

describe('swaggerSpec — DEP0169 regression guard', () => {
  /**
   * The entire reason swaggerSpec.js exists is to avoid the Node.js 24+
   * DEP0169 url.parse() deprecation triggered by swagger-jsdoc via
   * @apidevtools/json-schema-ref-parser. Verify that the replacement never
   * re-introduces those packages.
   */
  test('source does not reference @apidevtools/swagger-parser', () => {
    const src = fs.readFileSync(require.resolve('../utils/swaggerSpec'), 'utf8');
    // Check only require() calls — comments explaining why a package is avoided
    // legitimately mention the package name and should not trigger this guard.
    expect(src).not.toMatch(/require\s*\(\s*['"]@apidevtools\/swagger-parser['"]\s*\)/);
  });

  test('source does not reference @apidevtools/json-schema-ref-parser', () => {
    const src = fs.readFileSync(require.resolve('../utils/swaggerSpec'), 'utf8');
    expect(src).not.toMatch(/require\s*\(\s*['"]@apidevtools\/json-schema-ref-parser['"]\s*\)/);
  });

  test('source does not reference swagger-jsdoc', () => {
    const src = fs.readFileSync(require.resolve('../utils/swaggerSpec'), 'utf8');
    expect(src).not.toMatch(/require\s*\(\s*['"]swagger-jsdoc['"]\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// 2. extractSwaggerBlocks — annotation parsing
// ---------------------------------------------------------------------------

describe('swaggerSpec — extractSwaggerBlocks (via generateSpec)', () => {
  const created = [];
  afterEach(() => {
    for (const f of created.splice(0)) {
      try { fs.unlinkSync(f); } catch (_) { /* already gone */ }
    }
  });

  test('parses a @swagger path annotation', () => {
    const f = tmpFile(`
/**
 * @swagger
 * /movies:
 *   get:
 *     summary: List movies
 */
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    expect(spec.paths['/movies']).toBeDefined();
    expect(spec.paths['/movies'].get.summary).toBe('List movies');
  });

  test('parses @openapi as an alias for @swagger', () => {
    const f = tmpFile(`
/**
 * @openapi
 * /shows:
 *   get:
 *     summary: List shows
 */
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    expect(spec.paths['/shows']).toBeDefined();
    expect(spec.paths['/shows'].get.summary).toBe('List shows');
  });

  test('ignores comments that have no @swagger/@openapi tag', () => {
    const f = tmpFile(`
/**
 * @param {string} name - The name parameter
 * @returns {string} The same name
 */
function identity(name) { return name; }
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    expect(Object.keys(spec.paths)).toHaveLength(0);
  });

  test('silently ignores malformed YAML without throwing', () => {
    const f = tmpFile(`
/**
 * @swagger
 * this: is: badly: nested: : : :
 */
`);
    created.push(f);
    expect(() => {
      const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
      expect(spec).toBeDefined();
    }).not.toThrow();
  });

  test('parses multiple @swagger blocks from a single file', () => {
    const f = tmpFile(`
/**
 * @swagger
 * /movies:
 *   get:
 *     summary: List movies
 */

/**
 * @swagger
 * /movies/{id}:
 *   get:
 *     summary: Get movie by id
 */
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    expect(spec.paths['/movies']).toBeDefined();
    expect(spec.paths['/movies/{id}']).toBeDefined();
  });

  test('a @tag line ends collection of the preceding @swagger block', () => {
    const f = tmpFile(`
/**
 * @swagger
 * /movies:
 *   get:
 *     summary: From swagger block
 * @param {string} id - Some param after the block
 */
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    // The path should be picked up before @param terminated the block
    expect(spec.paths['/movies']).toBeDefined();
    // @param text must not bleed into the spec output
    expect(JSON.stringify(spec)).not.toContain('@param');
  });

  test('file with no JSDoc comments produces empty paths', () => {
    const f = tmpFile(`// Just a comment\nconst x = 1;\n`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    expect(Object.keys(spec.paths)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. deepMerge — merge strategy
// ---------------------------------------------------------------------------

describe('swaggerSpec — deepMerge (via generateSpec multi-file)', () => {
  const created = [];
  afterEach(() => {
    for (const f of created.splice(0)) {
      try { fs.unlinkSync(f); } catch (_) { /* already gone */ }
    }
  });

  test('merges nested objects from two separate files', () => {
    const f1 = tmpFile(`
/**
 * @swagger
 * components:
 *   schemas:
 *     Movie:
 *       type: object
 */
`);
    const f2 = tmpFile(`
/**
 * @swagger
 * components:
 *   schemas:
 *     Show:
 *       type: object
 */
`);
    created.push(f1, f2);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f1, f2] });
    expect(spec.components.schemas.Movie).toBeDefined();
    expect(spec.components.schemas.Show).toBeDefined();
  });

  test('concatenates arrays (tags) rather than overwriting', () => {
    const f1 = tmpFile(`
/**
 * @swagger
 * tags:
 *   - name: Movies
 *     description: Movie endpoints
 */
`);
    const f2 = tmpFile(`
/**
 * @swagger
 * tags:
 *   - name: Shows
 *     description: Show endpoints
 */
`);
    created.push(f1, f2);
    const spec = generateSpec({
      definition: { ...BASE_DEF, tags: [] },
      apis: [f1, f2],
    });
    const names = spec.tags.map((t) => t.name);
    expect(names).toContain('Movies');
    expect(names).toContain('Shows');
  });

  test('scalar values from later files overwrite earlier values', () => {
    const f1 = tmpFile(`
/**
 * @swagger
 * info:
 *   title: First title
 *   version: 1.0.0
 */
`);
    const f2 = tmpFile(`
/**
 * @swagger
 * info:
 *   title: Second title
 */
`);
    created.push(f1, f2);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f1, f2] });
    expect(spec.info.title).toBe('Second title');
    // version was only in f1, should be preserved
    expect(spec.info.version).toBe('1.0.0');
  });

  test('deeply nested object merge does not clobber sibling keys', () => {
    const f1 = tmpFile(`
/**
 * @swagger
 * components:
 *   schemas:
 *     Movie:
 *       type: object
 *   securitySchemes:
 *     ApiKey:
 *       type: apiKey
 */
`);
    const f2 = tmpFile(`
/**
 * @swagger
 * components:
 *   schemas:
 *     Show:
 *       type: object
 */
`);
    created.push(f1, f2);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f1, f2] });
    expect(spec.components.schemas.Movie).toBeDefined();
    expect(spec.components.schemas.Show).toBeDefined();
    // securitySchemes from f1 must survive the f2 merge
    expect(spec.components.securitySchemes.ApiKey).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. organizeBlock — routing logic
// ---------------------------------------------------------------------------

describe('swaggerSpec — organizeBlock (via generateSpec)', () => {
  const created = [];
  afterEach(() => {
    for (const f of created.splice(0)) {
      try { fs.unlinkSync(f); } catch (_) { /* already gone */ }
    }
  });

  test('bare /path keys are routed to spec.paths', () => {
    const f = tmpFile(`
/**
 * @swagger
 * /movies:
 *   get:
 *     summary: List movies
 */
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    expect(spec.paths).toHaveProperty('/movies');
  });

  test('x-webhooks key is placed at spec["x-webhooks"]', () => {
    const f = tmpFile(`
/**
 * @swagger
 * x-webhooks:
 *   newMedia:
 *     post:
 *       summary: New media webhook
 */
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    expect(spec['x-webhooks']).toBeDefined();
    expect(spec['x-webhooks'].newMedia).toBeDefined();
  });

  test('well-known top-level key "components" is placed directly in spec', () => {
    const f = tmpFile(`
/**
 * @swagger
 * components:
 *   securitySchemes:
 *     ApiKey:
 *       type: apiKey
 *       in: header
 *       name: X-API-Key
 */
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    expect(spec.components.securitySchemes.ApiKey).toBeDefined();
  });

  test('well-known top-level key "servers" is placed in spec', () => {
    const f = tmpFile(`
/**
 * @swagger
 * servers:
 *   - url: /api/v2
 *     description: V2 endpoint
 */
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    const urls = (spec.servers || []).map((s) => s.url);
    expect(urls).toContain('/api/v2');
  });

  test('unknown x-* vendor extension keys are skipped', () => {
    const f = tmpFile(`
/**
 * @swagger
 * x-private-internal:
 *   secret: value
 */
`);
    created.push(f);
    const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
    expect(spec['x-private-internal']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. resolvePattern — file resolution
// ---------------------------------------------------------------------------

describe('swaggerSpec — resolvePattern (via generateSpec)', () => {
  test('existing non-glob path resolves correctly', () => {
    const f = tmpFile(`
/**
 * @swagger
 * /test-resolve:
 *   get:
 *     summary: Resolve test
 */
`);
    try {
      const spec = generateSpec({ definition: BASE_DEF, apis: [f] });
      expect(spec.paths['/test-resolve']).toBeDefined();
    } finally {
      fs.unlinkSync(f);
    }
  });

  test('non-existent non-glob path is silently skipped', () => {
    const missing = path.join(os.tmpdir(), 'classifarr_absolutely_missing_file.js');
    const spec = generateSpec({ definition: BASE_DEF, apis: [missing] });
    expect(Object.keys(spec.paths)).toHaveLength(0);
  });

  test('glob *.js resolves matching files in a directory', () => {
    const dir = tmpDir();
    const routeFile = path.join(dir, 'routes.js');
    const helperFile = path.join(dir, 'helper.js');
    fs.writeFileSync(routeFile, `
/**
 * @swagger
 * /glob-route:
 *   get:
 *     summary: Found via glob
 */
`, 'utf8');
    fs.writeFileSync(helperFile, '// no swagger here\n', 'utf8');
    try {
      const spec = generateSpec({ definition: BASE_DEF, apis: [path.join(dir, '*.js')] });
      expect(spec.paths['/glob-route']).toBeDefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('glob in non-existent directory returns empty without throwing', () => {
    const missing = path.join(os.tmpdir(), 'classifarr_no_such_dir_xyz', '*.js');
    expect(() => {
      const spec = generateSpec({ definition: BASE_DEF, apis: [missing] });
      expect(Object.keys(spec.paths)).toHaveLength(0);
    }).not.toThrow();
  });

  test('multiple patterns in apis array are each resolved', () => {
    const f1 = tmpFile(`
/**
 * @swagger
 * /from-first:
 *   get:
 *     summary: From first pattern
 */
`);
    const f2 = tmpFile(`
/**
 * @swagger
 * /from-second:
 *   get:
 *     summary: From second pattern
 */
`);
    try {
      const spec = generateSpec({ definition: BASE_DEF, apis: [f1, f2] });
      expect(spec.paths['/from-first']).toBeDefined();
      expect(spec.paths['/from-second']).toBeDefined();
    } finally {
      fs.unlinkSync(f1);
      fs.unlinkSync(f2);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. generateSpec — integration & immutability
// ---------------------------------------------------------------------------

describe('swaggerSpec — generateSpec integration', () => {
  const created = [];
  afterEach(() => {
    for (const f of created.splice(0)) {
      try { fs.unlinkSync(f); } catch (_) { /* already gone */ }
    }
  });

  test('does not mutate the caller\'s input definition object', () => {
    const f = tmpFile(`
/**
 * @swagger
 * /movies:
 *   get:
 *     summary: List movies
 */
`);
    created.push(f);
    const definition = { ...BASE_DEF };
    const snapshot = JSON.stringify(definition);
    generateSpec({ definition, apis: [f] });
    expect(JSON.stringify(definition)).toBe(snapshot);
  });

  test('removes empty placeholder props (definitions, responses, parameters, securityDefinitions)', () => {
    const spec = generateSpec({ definition: BASE_DEF, apis: [] });
    expect(spec).not.toHaveProperty('definitions');
    expect(spec).not.toHaveProperty('responses');
    expect(spec).not.toHaveProperty('parameters');
    expect(spec).not.toHaveProperty('securityDefinitions');
  });

  test('skips unreadable/missing files without throwing', () => {
    expect(() => {
      const spec = generateSpec({ definition: BASE_DEF, apis: ['/absolutely/does/not/exist.js'] });
      expect(spec).toBeDefined();
    }).not.toThrow();
  });

  test('empty apis array returns spec matching the base definition', () => {
    const spec = generateSpec({ definition: BASE_DEF, apis: [] });
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBe('Test');
    expect(spec.paths).toEqual({});
  });

  test('default apis value (omitted) behaves same as empty array', () => {
    const spec = generateSpec({ definition: BASE_DEF });
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.paths).toEqual({});
  });

  test('produces a complete spec end-to-end with a real route fixture', () => {
    const f = tmpFile(`
/**
 * @swagger
 * /movies:
 *   get:
 *     summary: List all movies
 *     description: Returns a paginated list of all movies
 *     responses:
 *       200:
 *         description: Success
 */
`);
    created.push(f);
    const spec = generateSpec({
      definition: {
        openapi: '3.0.0',
        info: { title: 'Classifarr API', version: '1.0.0' },
        servers: [{ url: '/api' }],
      },
      apis: [f],
    });
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBe('Classifarr API');
    expect(spec.servers[0].url).toBe('/api');
    expect(spec.paths['/movies'].get.summary).toBe('List all movies');
    expect(spec.paths['/movies'].get.responses[200].description).toBe('Success');
  });

  test('definition with pre-populated paths is preserved and extended', () => {
    const f = tmpFile(`
/**
 * @swagger
 * /new-route:
 *   get:
 *     summary: New route
 */
`);
    created.push(f);
    const spec = generateSpec({
      definition: {
        ...BASE_DEF,
        paths: { '/existing': { get: { summary: 'Existing' } } },
      },
      apis: [f],
    });
    expect(spec.paths['/existing']).toBeDefined();
    expect(spec.paths['/new-route']).toBeDefined();
  });
});
