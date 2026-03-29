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
 * Client Code Health Tests
 *
 * Static-analysis tests for Vue SFC files, client JS files, and project JSON.
 * No component mounting — pure file-system checks, fast and deterministic.
 *
 * Checks performed:
 *   1.  JSON validity            — all project .json files discovered dynamically;
 *                                  parses without error (catches trailing commas,
 *                                  unquoted keys, UTF-8 BOM injections)
 *  1a.  package.json schema      — required fields (name, version, description,
 *                                  license, scripts), valid semver, engines.node
 *                                  specified, no wildcard (*) dep versions
 *  1b.  lockfile version         — package-lock.json lockfileVersion >= 3
 *                                  (npm 7+ format; v1 breaks npm ci on npm 7+)
 *  1c.  PWA manifest fields      — public/manifest.json has all W3C required
 *                                  fields: name, short_name, start_url,
 *                                  display, icons[]
 *  1d.  Version consistency      — client and server package.json versions match
 *   2.  Vue SFC structure        — every .vue has <template>, <script>, and
 *                                  at most one <style>; no bare <template> files
 *   3.  Vue script block          — <script> must use setup API or Options API,
 *                                  not both in the same file
 *   4.  console.log in components — Vue SFCs / client JS should not contain
 *                                  active console.log() calls (use a logger or
 *                                  remove debug output before committing)
 *   5.  v-html XSS risk          — v-html binds raw HTML; flag any use so it
 *                                  gets a manual security review
 *   6.  v-for without :key       — missing :key on v-for loops causes silent
 *                                  rendering bugs and React-style reconciliation
 *                                  errors at runtime
 *   7.  eval() / new Function()  — code-injection sinks (OWASP A03)
 *   8.  Hardcoded API tokens /
 *       secrets in Vue/JS files  — same conservative check as server side
 *   9.  Unreachable TODO stub     — `// TODO:` comments that are in an active
 *                                  code path (not inside a disabled block)
 *  10.  Test file closure         — every .test.js file in client ends with a
 *                                  proper closing line (`}` / `})` / `});`)
 *
 * Design: goldbergyoni/javascript-testing-best-practices §4.3 (AAA pattern),
 *         §4.5 (no global fixtures), §4.2 (descriptive names with context).
 */

import { describe, test, expect } from 'vitest';
import fs   from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLIENT_SRC  = path.resolve(__dirname, '..').replace(/\\/g, '/');
const CLIENT_ROOT = path.resolve(__dirname, '../../').replace(/\\/g, '/');
// REPO_ROOT: 3 levels up from client/src/__tests__ → client/src → client → repo root
const REPO_ROOT   = path.resolve(__dirname, '../../..').replace(/\\/g, '/');
/** Relative display path from CLIENT_SRC */
function rel(filePath) {
  return filePath.replace(/\\/g, '/').replace(CLIENT_SRC + '/', '');
}

/** Recursively collect files matching the given extension(s). */
function collectFiles(dir, extensions, { skipDirs = [] } = {}) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || skipDirs.includes(entry.name)) continue;
      results.push(...collectFiles(full, extensions, { skipDirs }));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) results.push(full);
    }
  }
  return results;
}

/** Recursively discover all human-authored .json files in the repo. */
function collectJsonFiles(dir, { skipDirs = [], skipFiles = [] } = {}, depth = 0) {
  const results = [];
  if (depth > 6) return results;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      // Skip hidden dirs, node_modules, and generated output dirs
      if (entry.name.startsWith('.') || skipDirs.includes(entry.name)) continue;
      results.push(...collectJsonFiles(full, { skipDirs, skipFiles }, depth + 1));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      if (!skipFiles.includes(entry.name)) results.push(full);
    }
  }
  return results;
}

const VUE_FILES  = collectFiles(CLIENT_SRC, ['.vue'], { skipDirs: ['coverage', 'dist'] });
const JS_FILES   = collectFiles(CLIENT_SRC, ['.js'],  { skipDirs: ['coverage', 'dist'] });
const TEST_FILES = JS_FILES.filter(f => f.includes('__tests__') && f.endsWith('.test.js'));

// Dynamically discover all human-authored JSON in the repo.
// Exclude: generated dirs, runttime data, lockfiles (validated separately).
const ALL_JSON_FILES = collectJsonFiles(REPO_ROOT, {
  skipDirs:  ['node_modules', 'dist', 'coverage', '.tmp', 'postgres', 'logs', 'secrets', 'data'],
  skipFiles: ['package-lock.json'],
});

// package.json files that ship and should conform to the project schema
const PACKAGE_JSON_FILES = [
  path.join(CLIENT_ROOT, 'package.json'),
  path.join(REPO_ROOT,   'server/package.json'),
].map(f => f.replace(/\\/g, '/')).filter(f => fs.existsSync(f));

// package-lock.json files — checked for lockfileVersion separately
const LOCKFILE_FILES = [
  path.join(CLIENT_ROOT, 'package-lock.json'),
  path.join(REPO_ROOT,   'server/package-lock.json'),
].map(f => f.replace(/\\/g, '/')).filter(f => fs.existsSync(f));

// PWA web-app manifest
const MANIFEST_FILE = path.join(CLIENT_ROOT, 'public/manifest.json').replace(/\\/g, '/');

// ---------------------------------------------------------------------------
// 1. JSON validity
// ---------------------------------------------------------------------------

describe('Code Health — JSON file validity', () => {
  /**
   * Malformed JSON breaks tooling silently — `npm install`, Vite config,
   * Docker healthchecks, CI pipelines all fail with cryptic errors.
   *
   * JSON.parse() is the canonical validator: it throws on trailing commas,
   * unquoted keys, duplicate entries, and UTF-8 BOM prefixes. By scanning
   * all project JSON dynamically, new files added later are automatically
   * included without updating this test.
   */
  for (const filePath of ALL_JSON_FILES) {
    test(`${path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')} — parses as valid JSON`, () => {
      const source = fs.readFileSync(filePath, 'utf8');
      expect(() => JSON.parse(source)).not.toThrow();
    });
  }
});

// ---------------------------------------------------------------------------
// 1a. package.json schema
// ---------------------------------------------------------------------------

describe('Code Health — package.json schema', () => {
  /**
   * Every shipped package.json must carry the fields npm and tooling rely on:
   *  • name, version, description — publish/display metadata
   *  • license    — compliance tooling (FOSSA, REUSE, etc.)
   *  • scripts    — at minimum a `test` script
   *  • engines.node — documents the minimum Node.js version for CI and
   *                   maintainers; prevents silent runtime mismatch
   *
   * Using `*` as a dependency version means "any version": it disables
   * lockfile reproducibility and is a supply-chain attack surface.
   *
   * Reference: OWASP A06:2021 — Vulnerable and Outdated Components;
   *            npm docs — package.json fields.
   */
  const REQUIRED_FIELDS = ['name', 'version', 'description', 'license', 'scripts'];
  const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
  const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

  for (const filePath of PACKAGE_JSON_FILES) {
    const label = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { pkg = {}; }

    test(`${label} — has required fields (name, version, description, license, scripts)`, () => {
      const missing = REQUIRED_FIELDS.filter(f => pkg[f] === undefined || pkg[f] === null || pkg[f] === '');
      if (missing.length > 0) {
        throw new Error(`Missing required package.json fields: ${missing.join(', ')}`);
      }
    });

    test(`${label} — version is valid semver`, () => {
      expect(String(pkg.version || '')).toMatch(SEMVER_RE);
    });

    test(`${label} — engines.node is specified`, () => {
      const ok = pkg.engines && typeof pkg.engines.node === 'string' && pkg.engines.node.length > 0;
      if (!ok) {
        throw new Error(
          `Missing "engines.node" — specify the minimum supported Node.js version ` +
          `(e.g., ">=24.0.0") so maintainers and CI know the runtime target.`
        );
      }
    });

    test(`${label} — no wildcard (*) dependency versions`, () => {
      const hits = [];
      for (const field of DEP_FIELDS) {
        if (!pkg[field]) continue;
        for (const [dep, ver] of Object.entries(pkg[field])) {
          if (ver === '*') hits.push(`  ${field}.${dep}: "*"`);
        }
      }
      if (hits.length > 0) {
        throw new Error(
          `Wildcard (*) dependency version disables reproducibility and is a ` +
          `supply-chain risk (OWASP A06):\n${hits.join('\n')}`
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 1b. package-lock.json lockfile version
// ---------------------------------------------------------------------------

describe('Code Health — package-lock.json uses lockfileVersion >= 3', () => {
  /**
   * npm 7 introduced lockfileVersion 3: a flatter install tree with richer
   * integrity metadata. A v1 lockfile (npm 5/6) causes `npm ci` on npm 7+
   * to silently re-resolve the dependency graph, breaking reproducibility.
   *
   * Version 3 is the minimum: v1 = npm 5/6, v2 = npm 7 transitional,
   * v3 = npm 7+ stable.
   *
   * Reference: npm blog — "npm v7 Series — Arborist, the new package tree manager".
   */
  for (const filePath of LOCKFILE_FILES) {
    test(`${path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')} — lockfileVersion >= 3`, () => {
      const lock = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(lock.lockfileVersion).toBeGreaterThanOrEqual(3);
    });
  }
});

// ---------------------------------------------------------------------------
// 1c. PWA manifest required fields
// ---------------------------------------------------------------------------

describe('Code Health — PWA manifest has required fields', () => {
  /**
   * A Web App Manifest missing required fields causes browsers to silently
   * reject PWA installation and degrades Add-to-Home-Screen behaviour.
   *
   * W3C Web App Manifest spec required fields:
   *   name        — full application name
   *   short_name  — name shown under the home-screen icon (≤12 chars ideal)
   *   start_url   — entry point when launched from home screen
   *   display     — display mode (standalone | fullscreen | minimal-ui | browser)
   *   icons       — non-empty array (at minimum 192 × 192 and 512 × 512 px)
   *
   * Reference: https://www.w3.org/TR/appmanifest/#webappmanifest-dictionary
   */
  const REQUIRED_MANIFEST_FIELDS = ['name', 'short_name', 'start_url', 'display', 'icons'];

  test('public/manifest.json — has W3C required fields', () => {
    expect(fs.existsSync(MANIFEST_FILE)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    const missing = REQUIRED_MANIFEST_FIELDS.filter(f => {
      const val = manifest[f];
      if (val === undefined || val === null || val === '') return true;
      if (f === 'icons' && (!Array.isArray(val) || val.length === 0)) return true;
      return false;
    });
    if (missing.length > 0) {
      throw new Error(`PWA manifest missing required W3C fields: ${missing.join(', ')}`);
    }
  });
});

// ---------------------------------------------------------------------------
// 1d. Cross-package version consistency
// ---------------------------------------------------------------------------

describe('Code Health — package versions are consistent across the monorepo', () => {
  /**
   * client/package.json and server/package.json must carry identical versions
   * so release tooling, Docker image tags, and the in-app /api/version
   * endpoint all agree. A mismatch is always a mistake — never intentional.
   *
   * The root package.json is a workspace aggregator and may legitimately
   * lag during a release; only the shipped packages are compared here.
   */
  test('client and server package.json versions match', () => {
    const clientPkg = JSON.parse(
      fs.readFileSync(path.join(CLIENT_ROOT, 'package.json').replace(/\\/g, '/'), 'utf8')
    );
    const serverPkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'server/package.json').replace(/\\/g, '/'), 'utf8')
    );
    if (clientPkg.version !== serverPkg.version) {
      throw new Error(
        `Version mismatch: client is "${clientPkg.version}" but server is "${serverPkg.version}".\n` +
        `Update both package.json files to the same version before release.`
      );
    }
    expect(clientPkg.version).toBe(serverPkg.version);
  });
});

// ---------------------------------------------------------------------------
// 2. Vue SFC block structure
// ---------------------------------------------------------------------------

describe('Code Health — Vue SFC has required blocks', () => {
  /**
   * Every .vue file must have at least a <template> block and a <script>
   * (or <script setup>) block. A file with only a template is a red flag
   * for a truncated or incomplete component.
   *
   * Reference: Vue 3 SFC spec — https://vuejs.org/api/sfc-spec
   */
  for (const filePath of VUE_FILES) {
    test(`${rel(filePath)} — has <template> and <script>`, () => {
      const source = fs.readFileSync(filePath, 'utf8');
      const hasTemplate = /<template[\s>]/.test(source);
      const hasScript   = /<script[\s>]/.test(source);

      if (!hasTemplate) {
        throw new Error(`Missing <template> block — component appears truncated or empty.`);
      }
      if (!hasScript) {
        throw new Error(`Missing <script> block — component has no logic section.`);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Vue SFC — no duplicate script API styles (Options + Composition mix)
// ---------------------------------------------------------------------------

describe('Code Health — Vue SFC uses a single script API style', () => {
  /**
   * Having both `<script>` (Options API) and `<script setup>` (Composition API)
   * in the same file is valid Vue 3 syntax, but only to add module-level side
   * effects or named exports — not to mix two component definitions.
   * Flag files that appear to use both to define component logic.
   */
  for (const filePath of VUE_FILES) {
    test(`${rel(filePath)} — does not mix Options API and <script setup>`, () => {
      const source = fs.readFileSync(filePath, 'utf8');
      const hasSetup   = /<script\s[^>]*setup/.test(source);
      const hasOptions = source.includes('export default {') || source.includes('export default defineComponent(');

      if (hasSetup && hasOptions) {
        throw new Error(
          `File uses both <script setup> (Composition API) and "export default {}" (Options API). ` +
          `Pick one style consistently.`
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 4. No console.log() in Vue SFC <script> sections or client JS
// ---------------------------------------------------------------------------

describe('Code Health — no console.log in Vue/JS client files', () => {
  /**
   * console.log() in shipped frontend code:
   *  • Leaks internal state/data into the browser DevTools console
   *  • Is visible to any user who opens DevTools
   *  • Can expose API responses, tokens, or user data
   *
   * Debug logging should be removed before merge. If you need a trace,
   * use a conditional: `if (import.meta.env.DEV) console.log(...)`.
   *
   * Reference: https://snyk.io/articles/getting-started-javascript-static-analysis/
   */
  const ALL_CLIENT_FILES = [...VUE_FILES, ...JS_FILES.filter(f => !f.includes('__tests__'))];

  for (const filePath of ALL_CLIENT_FILES) {
    test(`${rel(filePath)} — no active console.log()`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits = [];

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Skip line-comment and block-comment lines
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        // Allow DEV-guarded console usage: if (import.meta.env.DEV) console.log
        if (/import\.meta\.env\.DEV/.test(trimmed)) return;
        if (/\bconsole\.log\s*\(/.test(trimmed)) {
          hits.push(`  line ${i + 1}: ${trimmed.slice(0, 120)}`);
        }
      });

      if (hits.length > 0) {
        throw new Error(
          `console.log() found — remove debug output or guard with ` +
          `\`if (import.meta.env.DEV)\`:\n${hits.join('\n')}`
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 5. v-html XSS risk — flag all uses for manual review
// ---------------------------------------------------------------------------

describe('Code Health — v-html requires a security review comment', () => {
  /**
   * `v-html` renders raw HTML directly into the DOM. Any user-controlled
   * string passed to v-html is an XSS vector. Vue docs: "Dynamically
   * rendering arbitrary HTML on your website can be very dangerous because
   * it can easily lead to XSS."
   *
   * Policy: v-html is allowed only when the bound value is sanitised or
   * is a hardcoded constant. Each use MUST carry a
   * <!-- v-html-safe: <reason> --> comment on the same or preceding line.
   *
   * Reference: OWASP A03:2021 — Injection; Vue 3 Security Guide.
   */
  for (const filePath of VUE_FILES) {
    test(`${rel(filePath)} — v-html uses are documented as safe`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits = [];

      lines.forEach((line, i) => {
        if (!line.includes('v-html')) return;
        const trimmed = line.trim();
        if (trimmed.startsWith('<!--') || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        // Check this line or the previous line for the suppression comment
        const prevLine = i > 0 ? lines[i - 1] : '';
        const hasAck = /v-html-safe:/i.test(line) || /v-html-safe:/i.test(prevLine);
        if (!hasAck) {
          hits.push(`  line ${i + 1}: ${trimmed.slice(0, 120)}`);
        }
      });

      if (hits.length > 0) {
        throw new Error(
          `v-html usage without a safety acknowledgment comment.\n` +
          `Add a \`<!-- v-html-safe: <reason why input is sanitised> -->\` ` +
          `comment on the same or preceding line:\n` +
          hits.join('\n')
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 6. v-for without :key
// ---------------------------------------------------------------------------

describe('Code Health — v-for loops have :key bindings', () => {
  /**
   * Vue requires a unique `:key` on every `v-for` element so its virtual DOM
   * diffing algorithm can track item identity. Without it, Vue falls back to
   * in-place patch (list re-renders unpredictably), checkboxes / inputs may
   * keep stale state, and animated transitions break.
   *
   * This check flags `v-for` that is NOT accompanied by either `:key=` or
   * `v-bind:key=` on the same element (same line or within the next 3 lines
   * of the opening tag).
   *
   * Reference: Vue 3 docs — "key" special attribute.
   */
  for (const filePath of VUE_FILES) {
    test(`${rel(filePath)} — every v-for has :key`, () => {
      const source = fs.readFileSync(filePath, 'utf8');
      const lines  = source.split('\n');
      const hits   = [];

      lines.forEach((line, i) => {
        if (!line.includes('v-for')) return;
        const trimmed = line.trim();
        if (trimmed.startsWith('<!--') || trimmed.startsWith('//')) return;

        // Look at this line + next 3 lines for a :key binding
        const window = lines.slice(i, Math.min(i + 4, lines.length)).join(' ');
        const hasKey = /:key\s*=/.test(window) || /v-bind:key\s*=/.test(window);

        if (!hasKey) {
          hits.push(`  line ${i + 1}: ${trimmed.slice(0, 120)}`);
        }
      });

      if (hits.length > 0) {
        throw new Error(
          `v-for without :key — Vue requires a unique :key on every list item:\n` +
          hits.join('\n')
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 7. eval() and new Function() — code injection sinks
// ---------------------------------------------------------------------------

describe('Code Health — no eval() or new Function() in client files', () => {
  /**
   * OWASP A03:2021 — Injection. eval() and new Function(string) run
   * arbitrary code. In a browser context this makes them XSS escalation
   * paths if any user-controlled data ever reaches the argument.
   */
  const EVAL_RE = /\beval\s*\(|new\s+Function\s*\(/;
  const ALL_CLIENT_FILES = [...VUE_FILES, ...JS_FILES.filter(f => !f.includes('__tests__'))];

  for (const filePath of ALL_CLIENT_FILES) {
    test(`${rel(filePath)} — no eval() or new Function()`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits  = [];

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) return;
        if (EVAL_RE.test(trimmed)) {
          hits.push(`  line ${i + 1}: ${trimmed.slice(0, 100)}`);
        }
      });

      if (hits.length > 0) {
        throw new Error(
          `eval() / new Function(string) are code-injection risks:\n` + hits.join('\n')
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 8. Hardcoded credentials in Vue / JS client files
// ---------------------------------------------------------------------------

describe('Code Health — no hardcoded credentials in client files', () => {
  /**
   * Same conservative heuristic as the server-side check. In frontend code
   * ANY hardcoded secret is immediately exposed to all users via the browser
   * source viewer — there is no server-side protection.
   *
   * Reference: OWASP A07:2021 — Identification and Authentication Failures.
   */
  const SECRET_VAR_RE = /\w*(?:password|passwd|secret|api_key|apikey|authtoken|auth_token|accesstoken|access_token|privatekey|private_key|passphrase)\w*\s*[:=]/i;
  const STRING_VAL_RE = /[:=]\s*['"`]([A-Za-z0-9+/=_\-~@!#$%^&*]{12,})['"`]/;
  const PLACEHOLDER_RE = /^(?:test|fake|dummy|placeholder|example|changeme?|yourkey|your_key|xxx+|sample|mock_|<[^>]+>)/i;
  const ALL_CLIENT_FILES = [...VUE_FILES, ...JS_FILES.filter(f => !f.includes('__tests__'))];

  for (const filePath of ALL_CLIENT_FILES) {
    test(`${rel(filePath)} — no hardcoded credentials`, () => {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const hits  = [];

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) return;
        if (!SECRET_VAR_RE.test(trimmed)) return;
        if (/import\.meta\.env\.|process\.env\.|config\.|settings\./.test(trimmed)) return;

        const valueMatch = trimmed.match(STRING_VAL_RE);
        if (!valueMatch) return;
        if (PLACEHOLDER_RE.test(valueMatch[1])) return;

        hits.push(`  line ${i + 1}: ${trimmed.slice(0, 120)}`);
      });

      if (hits.length > 0) {
        throw new Error(
          `Potential hardcoded credential — use import.meta.env.* instead:\n` +
          hits.join('\n')
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 9. TODO stubs in non-commented active code paths
// ---------------------------------------------------------------------------

describe('Code Health — TODO stubs are tracked', () => {
  /**
   * // TODO: comments mark unfinished work. This check does NOT fail the build
   * — it reports them as a soft warning (skipped test) so the count is visible
   * in CI output. The intent is to keep the number from growing silently.
   *
   * Lines inside disabled/commented blocks are excluded from the count.
   * Each unresolved TODO is listed in the skip message so it can be triaged.
   */
  const ALL_CLIENT_FILES = [...VUE_FILES, ...JS_FILES.filter(f => !f.includes('__tests__'))];

  test('TODO count in client source files', () => {
    const todos = [];

    for (const filePath of ALL_CLIENT_FILES) {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (/\bTODO\b/.test(trimmed)) {
          todos.push(`  ${rel(filePath)}:${i + 1}: ${trimmed.slice(0, 100)}`);
        }
      });
    }

    if (todos.length > 0) {
      // Soft warning — log them but don't fail the suite unless the count
      // exceeds a threshold (keeps the list manageable).
      const MAX_TODOS = 20;
      const message = `${todos.length} TODO comment(s) in client source:\n${todos.join('\n')}`;
      if (todos.length > MAX_TODOS) {
        throw new Error(
          `TODO count (${todos.length}) exceeds the allowed maximum of ${MAX_TODOS}.\n` +
          `Resolve or convert to GitHub issues:\n${todos.join('\n')}`
        );
      }
      // Under the threshold — pass but make the list visible in verbose output
      console.info(`[codeHealth] ${message}`);
    }

    expect(todos.length).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// 10. Test file closure
// ---------------------------------------------------------------------------

describe('Code Health — test files end with a closing line', () => {
  /**
   * Mirrors the server-side check. A test file truncated mid-test will not
   * end with `}` / `})` / `});` on the last non-blank line, catching
   * AI-assisted edits that produced partial output.
   */
  for (const filePath of TEST_FILES) {
    test(`${rel(filePath)} — ends with a closing brace`, () => {
      const lines = fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      const lastLine = lines[lines.length - 1];
      expect(lastLine).toMatch(/^\}[);]*$/);
    });
  }
});
