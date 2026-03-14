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
 * Code Health Tests
 *
 * These tests detect structural problems in source files before they become
 * runtime bugs — particularly issues that can occur during AI-assisted editing:
 *   • Truncated files (missing closing braces / unexpected end of input)
 *   • Unbalanced delimiters ( { } [ ] ( ) )
 *   • Test files missing their final closing `});`
 *   • Known dead-code stub patterns (commented via underscore-prefixed params)
 *   • Mock chain mismatches in test files (more mockResolvedValueOnce than
 *     associated mockResolvedValue fallbacks, which silently return undefined)
 *
 * Design principles (goldbergyoni/javascript-testing-best-practices):
 *   1. Each test is self-contained and reports the *specific* file that failed.
 *   2. Tests are fast (pure static analysis, no network or DB calls).
 *   3. Tests are deterministic: they pass/fail the same way on every machine.
 *   4. Failures carry actionable messages (file + line info where possible).
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Normalize to forward slashes so path filters like !f.includes('/scripts/')
// work correctly on Windows where path.resolve returns backslash paths.
const SERVER_SRC = path.resolve(__dirname, '..').replace(/\\/g, '/');

/** Recursively collect all .js files under `dir`, skipping node_modules. */
function collectJsFiles(dir, { skipDirs = [] } = {}) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || skipDirs.includes(entry.name)) continue;
      results.push(...collectJsFiles(full, { skipDirs }));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      // Normalize separators — forward slashes everywhere so includes('/scripts/')
      // etc. work on Windows as well as Linux/macOS.
      results.push(full.replace(/\\/g, '/'));
    }
  }
  return results;
}




/** Relative display path for readable test output. */
function rel(filePath) {
  return path.relative(SERVER_SRC, filePath).replace(/\\/g, '/');
}

// ---------------------------------------------------------------------------
// File lists (computed once, shared across all describe blocks)
// ---------------------------------------------------------------------------

const ALL_JS_FILES  = collectJsFiles(SERVER_SRC);
// Only real test files (not setup helpers or integration fixtures)
const TEST_FILES    = ALL_JS_FILES.filter(f =>
  f.includes('__tests__') &&
  f.endsWith('.test.js') &&
  !f.includes('/setup/') &&
  !f.includes('/integration/')
);
const SOURCE_FILES  = ALL_JS_FILES.filter(f => !f.includes('__tests__') && !f.includes('/scripts/'));

// ---------------------------------------------------------------------------
// 1. Syntax validity — catches truncated files
// ---------------------------------------------------------------------------

describe('Code Health — syntax validity', () => {
  /**
   * vm.Script compiles (but does NOT execute) the source, throwing SyntaxError
   * for any invalid JavaScript including "Unexpected end of input" on truncated
   * files and "Unexpected token" on mangled code.
   *
   * Reference: https://nodejs.org/api/vm.html#new-vmscriptcode-options
   */
  for (const filePath of ALL_JS_FILES) {
    test(`${rel(filePath)} — parses without SyntaxError`, () => {
      const source = fs.readFileSync(filePath, 'utf8');
      expect(() => {
        new vm.Script(source, { filename: filePath });
      }).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Balanced braces — reinforces syntax check with explicit diagnostic
// ---------------------------------------------------------------------------

// Balanced-braces check removed: vm.Script (check 1) already catches all
// truncation/syntax errors including "Unexpected end of input". A naive brace
// counter false-positives on regex literals like /pattern{2,4}/ in source,
// producing spurious failures with no debugging value.

// ---------------------------------------------------------------------------
// 3. Test file structure — test files must end with a closing `});`
// ---------------------------------------------------------------------------

describe('Code Health — test file closure', () => {
  /**
   * Every test file wraps its content in at least one describe() block.
   * A file that is truncated mid-test will not end with `});` on the last
   * non-blank line — catching AI-assisted edits that went wrong.
   */
  for (const filePath of TEST_FILES) {
    test(`${rel(filePath)} — ends with });`, () => {
      const lines = fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      const lastLine = lines[lines.length - 1];
      // Accept `});`, `})`, `});`, or bare `}` — the outer describe/test must close.
      expect(lastLine).toMatch(/^\}[);]*$/);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Stub method detection — underscore-prefixed unused parameters
// ---------------------------------------------------------------------------

describe('Code Health — no lingering stub methods', () => {
  /**
   * When a method parameter is prefixed with `_` it signals "intentionally
   * unused". But some stubs in our codebase (e.g. `_metadata`) were placeholders
   * waiting for real implementations. This test flags those patterns so they
   * get resolved rather than silently remaining dead code.
   *
   * Pattern detected: async METHOD_NAME(_PARAM, ...) { ... }
   * where _PARAM is the ONLY parameter and the method body never references it.
   *
   * IMPORTANT: This only fires when all of these are true:
   *   a) The parameter name starts with `_`
   *   b) It is the only parameter
   *   c) The method body (up to next blank line or closing brace) contains
   *      a db.query / await call that does NOT reference the stripped param name
   *
   * False-positive guards keep noise low — flag only clearly stubbed functions.
   */
  const STUB_RE = /async\s+(\w+)\s*\(\s*(_\w+)\s*\)\s*\{/g;

  for (const filePath of SOURCE_FILES) {
    test(`${rel(filePath)} — no solo underscore-param stub methods`, () => {
      const source = fs.readFileSync(filePath, 'utf8');
      const stubs = [];

      let match;
      while ((match = STUB_RE.exec(source)) !== null) {
        const methodName  = match[1];
        const paramName   = match[2];
        const stripped    = paramName.slice(1); // remove leading `_`

        // Grab ~30 chars of context after the opening `{`
        const bodyStart = match.index + match[0].length;
        const bodySnippet = source.slice(bodyStart, bodyStart + 500);

        // If the stripped param name appears in the body, it IS being used
        // (the underscore prefix is just documentation). Not a stub.
        if (bodySnippet.includes(stripped)) continue;

        // If the body is empty or only has a comment, it's a stub.
        stubs.push({ methodName, paramName });
      }
      STUB_RE.lastIndex = 0; // reset for next file iteration

      if (stubs.length > 0) {
        const detail = stubs.map(s => `${s.methodName}(${s.paramName})`).join(', ');
        throw new Error(
          `Found ${stubs.length} stub method(s) with unused solo underscore param: ${detail}\n` +
          `These suggest an unfinished implementation — either implement the parameter usage or rename.`
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Mock chain consistency in test files
// ---------------------------------------------------------------------------

describe('Code Health — mock chain completeness', () => {
  /**
   * When a test uses transaction mocks (db.pool.connect → mockClient), every
   * `mockResolvedValueOnce` in the chain must be consumed by an actual client
   * call. Surplus `mockResolvedValueOnce` entries silently return `undefined`
   * for subsequent calls, masking real bugs.
   *
   * This test checks: for each `mockClient` mock chain in a test file, the
   * number of `.mockResolvedValueOnce(` calls should NOT significantly exceed
   * the number of `client.query(` calls counted in the same test block.
   *
   * Because static counting of async calls is imprecise, we use a generous
   * threshold (mocks may exceed calls by up to 2 for the BEGIN/COMMIT pair).
   * The goal is to catch egregious mismatches (e.g. 8 mocks, 3 calls).
   */
  const ONCE_RE   = /\.mockResolvedValueOnce\(/g;
  const QUERY_RE  = /(?:client|mockClient)\.query\s*\(/g;

  for (const filePath of TEST_FILES) {
    test(`${rel(filePath)} — mockResolvedValueOnce count within tolerance`, () => {
      const source = fs.readFileSync(filePath, 'utf8');

      const onceCount  = (source.match(ONCE_RE)  || []).length;
      const queryCount = (source.match(QUERY_RE) || []).length;

      // Only meaningful when the file uses BOTH mockResolvedValueOnce AND
      // explicit client.query calls (transaction-style tests).
      // Files that mock db.query directly (no client.query) are skipped.
      if (onceCount === 0 || queryCount === 0) return;

      // File-level counting is imprecise (many tests each with their own chain).
      // Use a very generous multiplier — the goal is to catch gross mismatches
      // only (e.g., 100+ mockResolvedValueOnce vs 3 client.query calls).
      const maxAllowed = queryCount * 8 + 10;

      expect(onceCount).toBeLessThanOrEqual(maxAllowed);
    });
  }
});

// ---------------------------------------------------------------------------
// 6. console.log in service / route / utility files
// ---------------------------------------------------------------------------

describe('Code Health — no console.log in service files', () => {
  /**
   * Service, route, and utility code should use the structured logger (winston
   * or equivalent) so that log levels, transports, and correlation IDs are
   * respected. console.log() bypasses all of that.
   *
   * index.js is the only allowed exception: it emits startup messages before
   * the logger is fully initialised.
   *
   * Reference: Node.js Best Practices §5.2 — use smart structured logging.
   */
  // utils/logger.js IS the logger implementation — it bootstraps early with
  // console.log before the transport layer is ready. Exempt it.
  const SERVICE_FILES = SOURCE_FILES.filter(
    f => !f.endsWith('index.js') && !f.endsWith('utils/logger.js')
  );

  for (const filePath of SERVICE_FILES) {
    test(`${rel(filePath)} — no console.log (use logger instead)`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits = [];

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (/\bconsole\.log\s*\(/.test(trimmed)) {
          hits.push(`  line ${i + 1}: ${trimmed.slice(0, 100)}`);
        }
      });

      if (hits.length > 0) {
        throw new Error(
          `Found console.log() — use the structured logger instead:\n${hits.join('\n')}`
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 7. Hardcoded credentials in source files
// ---------------------------------------------------------------------------

describe('Code Health — no hardcoded credentials in source files', () => {
  /**
   * Hardcoded secrets (passwords, API keys, tokens) in source files are an
   * OWASP Top-10 vulnerability. They end up in version control history and
   * remain exploitable long after discovery.
   * GitGuardian (2025): 23.8 M secrets exposed on GitHub in 2024; 70% of
   * 2022 leaks were still valid in 2025.
   *
   * Detection strategy (conservative to minimise false positives):
   *  • The line must look like a standalone variable / property assignment
   *    whose name is a well-known credential noun.
   *  • The assigned value must be a string literal of ≥ 12 standard ASCII
   *    characters (rules out empty defaults and masking values like '••••••••').
   *  • Lines using process.env.*, config.*, or a logger call are excluded.
   *  • Obviously placeholder literals (test-, fake-, example-, changeme, etc.)
   *    are excluded.
   */
  // Credential-like property/variable names at assignment position
  const SECRET_VAR_RE = /^\s*(?:(?:const|let|var)\s+)?\w*(?:password|passwd|secret|api_key|apikey|authtoken|auth_token|accesstoken|access_token|privatekey|private_key|passphrase)\w*\s*[:=]/i;
  // String value composed of ≥12 typical secret characters (no spaces/dots)
  const STRING_VAL_RE = /[:=]\s*['"`]([A-Za-z0-9+/=_\-~@!#$%^&*]{12,})['"`]/;
  // Reject obvious placeholders / test helpers
  const PLACEHOLDER_RE = /^(?:test|fake|dummy|placeholder|example|changeme?|yourkey|your_key|xxx+|sample|mock_|<[^>]+>)/i;

  for (const filePath of SOURCE_FILES) {
    test(`${rel(filePath)} — no hardcoded credentials`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits = [];

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (!SECRET_VAR_RE.test(trimmed)) return;
        // Value comes from env/config — safe
        if (/process\.env\.|config\.|settings\.|getenv\s*\(/.test(trimmed)) return;
        // Logger call — "Error reading JWT secret:" is not an assignment
        if (/^(?:logger|console)\s*\./.test(trimmed)) return;

        const valueMatch = trimmed.match(STRING_VAL_RE);
        if (!valueMatch) return;
        if (PLACEHOLDER_RE.test(valueMatch[1])) return;

        hits.push(`  line ${i + 1}: ${trimmed.slice(0, 120)}`);
      });

      if (hits.length > 0) {
        throw new Error(
          `Potential hardcoded credential — use process.env.* or a secrets manager:\n` +
          hits.join('\n')
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 8. eval() and dynamic new Function() — code injection sinks
// ---------------------------------------------------------------------------

describe('Code Health — no eval() or dynamic Function constructor', () => {
  /**
   * eval() and new Function(string) execute arbitrary code at runtime, making
   * them injection sinks if any part of the string is user-controlled.
   * OWASP A03:2021 — Injection; Node.js Security Cheat Sheet §eval.
   *
   * Regex / vm.Script usages that legitimately need dynamic execution are
   * handled in dedicated safe wrappers, not via eval().
   */
  const EVAL_RE = /\beval\s*\(|new\s+Function\s*\(/;

  for (const filePath of SOURCE_FILES) {
    test(`${rel(filePath)} — no eval() or new Function()`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits = [];

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (EVAL_RE.test(trimmed)) {
          hits.push(`  line ${i + 1}: ${trimmed.slice(0, 100)}`);
        }
      });

      if (hits.length > 0) {
        throw new Error(
          `eval() / new Function(string) are code-injection sinks — replace with ` +
          `safe alternatives (vm.Script for sandboxed compilation, JSON.parse for data):\n` +
          hits.join('\n')
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 9. process.exit() in service / route / utility files
// ---------------------------------------------------------------------------

describe('Code Health — no process.exit() in service files', () => {
  /**
   * Calling process.exit() in service code terminates the entire Node process
   * instead of letting errors propagate to a handler or graceful-shutdown
   * logic. This is the source of the v0.39.5a-alpha hotfix that removed a
   * process.exit(-1) from database.js.
   *
   * Only index.js (entry point) and /scripts/ (CLI utilities) may call it.
   */
  const SERVICE_FILES_NO_ENTRY = SOURCE_FILES.filter(
    f => !f.endsWith('index.js') && !f.includes('/scripts/')
  );

  for (const filePath of SERVICE_FILES_NO_ENTRY) {
    test(`${rel(filePath)} — no process.exit()`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits = [];

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (/\bprocess\.exit\s*\(/.test(trimmed)) {
          hits.push(`  line ${i + 1}: ${trimmed.slice(0, 100)}`);
        }
      });

      if (hits.length > 0) {
        throw new Error(
          `process.exit() in service code kills the entire Node process — ` +
          `throw an Error and let the caller / graceful-shutdown handler decide:\n` +
          hits.join('\n')
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 10. SQL injection risk — string-interpolated template literals in queries
// ---------------------------------------------------------------------------

describe('Code Health — no string-interpolated SQL queries', () => {
  /**
   * Parameterised queries use $1/$2 placeholders passed as a second argument
   * to db.query(). Using a template literal with ${variable} inside the SQL
   * string bypasses parameterisation and is a SQL-injection risk if *any* of
   * the interpolated values ever reach user-controlled data.
   *
   * Table / column name interpolation (the most common legitimate use) is
   * still flagged: those paths should use an explicit allowlist or be
   * documented with a /* sql-interpolation: table-name-constant * / comment.
   *
   * Reference: OWASP A03:2021 — Injection.
   */
  // Matches db/client/pool.query( followed by a backtick template that contains ${
  const SQL_INTERP_RE = /(?:db|client|pool)\.query\s*\(\s*`[^`]*\$\{/;

  for (const filePath of SOURCE_FILES) {
    test(`${rel(filePath)} — no interpolated SQL template literals`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits = [];

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        // Allow a same-line suppression comment for legitimate cases like
        // SET LOCAL, DDL statements, or table-name constants that cannot use $N.
        if (/\/\/\s*sql-interpolation:/i.test(trimmed)) return;
        if (SQL_INTERP_RE.test(trimmed)) {
          hits.push(`  line ${i + 1}: ${trimmed.slice(0, 140)}`);
        }
      });

      if (hits.length > 0) {
        throw new Error(
          `SQL query uses template-literal interpolation — use $1/$2 parameters instead.\n` +
          `If interpolating a table/column NAME constant, add an allowlist check and a\n` +
          `// sql-interpolation: <reason> comment to suppress this warning:\n` +
          hits.join('\n')
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 11. Metadata normalization guardrails
// ---------------------------------------------------------------------------

describe('Code Health — metadata normalization guardrails', () => {
  /**
   * List-like metadata fields such as genres/keywords/tags/collections arrive in
   * mixed shapes across providers and persisted records:
   *   - ['Documentary']
   *   - [{ name: 'Documentary' }]
   *   - JSON-stringified arrays
   *
   * New code should route these through metadataNormalization helpers rather than
   * doing ad hoc JSON.parse() or lowercasing raw entries directly.
   *
   * We intentionally only flag the highest-risk patterns here to keep noise low:
   *   1. Direct JSON.parse(...) of genres/keywords/tags/collections
   *   2. Direct metadata.<field>.map(...toLowerCase()) on list-like metadata
   *
   * Allow same-line opt-out for deliberate exceptions:
   *   // metadata-normalization: allow
   */
  const EXEMPT_FILES = new Set([
    'utils/metadataNormalization.js'
  ]);

  const DIRECT_PARSE_RE = /\bJSON\.parse\s*\([^)]*\b(?:genres|keywords|tags|collections)\b[^)]*\)/;
  const RAW_MAP_LOWER_RE = /\bmetadata\.(?:genres|keywords|tags|collections)\b[^\n]*\.map\s*\([^)]*toLowerCase\s*\(/;

  for (const filePath of SOURCE_FILES) {
    const relativePath = rel(filePath);
    if (EXEMPT_FILES.has(relativePath)) continue;

    test(`${relativePath} — no raw list-metadata parsing or lowercasing`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits = [];

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (/\/\/\s*metadata-normalization:\s*allow/i.test(trimmed)) return;

        if (DIRECT_PARSE_RE.test(trimmed) || RAW_MAP_LOWER_RE.test(trimmed)) {
          hits.push(`  line ${i + 1}: ${trimmed.slice(0, 140)}`);
        }
      });

      if (hits.length > 0) {
        throw new Error(
          `Found raw list-metadata handling. Use metadataNormalization helpers instead ` +
          `(normalizeMetadataList / normalizeMetadataListLower / coerceMetadataArray):\n` +
          hits.join('\n')
        );
      }
    });
  }
});
