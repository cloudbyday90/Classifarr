/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const client = fileURLToPath(new URL('../../client/', import.meta.url));
const require = createRequire(new URL('../../client/package.json', import.meta.url));
const { compile } = require('tailwindcss');
const postcss = require('postcss');
const tailwindPostcss = require('@tailwindcss/postcss');
const execute = promisify(execFile);

async function build(source) {
  const compiler = await compile(`@tailwind utilities; ${source}`);
  return postcss.parse(compiler.build([]));
}

test('Tailwind preserves ordinary rules and comment-like custom-property tokens', { timeout: 15000 }, async () => {
  const root = await build('a { color: red } b { color: blue } .tokens { --tokens: <!-- -->; color: green }');
  assert.deepEqual(root.nodes.filter(node => node.type === 'rule').map(node => node.selector), ['a', 'b', '.tokens']);
  assert.equal(root.nodes.find(node => node.selector === '.tokens').nodes[0].value, '<!-- -->');
  assert.equal(root.nodes.find(node => node.selector === 'b').nodes[0].value, 'blue');
});

for (const marker of ['<!--', '-->', '<!-- -->']) {
  test(`Tailwind ignores top-level ${marker} without corrupting adjacent CSS rules`, { timeout: 15000 }, async () => {
    const root = await build(`a { color: red } ${marker} b { color: blue }`);
    assert.deepEqual(root.nodes.filter(node => node.type === 'rule').map(node => node.selector), ['a', 'b']);
    const declarations = [];
    root.walkDecls(declaration => declarations.push([declaration.prop, declaration.value]));
    assert.deepEqual(declarations, [['color', 'red'], ['color', 'blue']]);
  });
}

for (const interpolation of ['', 'in oklab, ']) {
  test(`Tailwind preserves color semantics with ${interpolation || 'default '}interpolation`, { timeout: 15000 }, async () => {
    const expression = `color-mix(${interpolation}currentcolor 50%, transparent)`;
    const root = await build(`.current { color: ${expression} }`);
    const rule = root.nodes.find(node => node.selector === '.current');
    assert.ok(rule);
    const directColors = rule.nodes.filter(node => node.type === 'decl' && node.prop === 'color').map(node => node.value);
    const conditionalColors = [];
    rule.walkAtRules('supports', supports => supports.walkDecls('color', declaration => conditionalColors.push(declaration.value)));
    // Upstream #20666 deliberately skips fallback generation when the
    // interpolation method is omitted. Explicit interpolation keeps its
    // supported fallback. Neither path may invent a transparent fallback.
    assert.deepEqual(directColors, interpolation ? ['currentcolor'] : [expression]);
    assert.deepEqual(conditionalColors, interpolation ? [expression] : []);
  });
}

test('Tailwind handles unresolved color-mix variables without inventing a fallback', { timeout: 15000 }, async () => {
  const root = await build('.variable { color: color-mix(var(--dynamic-color)) }');
  const colors = [];
  root.walkDecls('color', declaration => colors.push(declaration.value));
  assert.ok(colors.includes('color-mix(var(--dynamic-color))'));
  assert.ok(!colors.includes('transparent'));
});

test('actual Tailwind PostCSS plugin resolves theme and explicit source utilities', { timeout: 15000 }, async () => {
  const result = await postcss([tailwindPostcss({ base: client, optimize: false })]).process(
    '@import "tailwindcss" source(none); @source inline("font-bold text-red-500");',
    { from: `${client}tailwind-contract.css` },
  );
  const root = postcss.parse(result.css);
  const selectors = [];
  root.walkRules(rule => selectors.push(rule.selector));
  assert.ok(selectors.includes('.font-bold'));
  assert.ok(selectors.includes('.text-red-500'));
  assert.ok(!result.css.includes('@source'));
  assert.deepEqual(result.warnings(), []);
});

for (const mode of ['native', 'wasi']) {
  test(`real ${mode} Oxide initialization and incremental source scans`, {
    timeout: 30000,
    skip: mode === 'wasi' && process.platform !== 'linux' ? 'upstream WASI filesystem control requires supported Linux runner' : false,
  }, async () => {
    const fixture = fileURLToPath(new URL('../fixtures/tailwind-oxide-scanner.mjs', import.meta.url));
    const { stdout } = await execute(process.execPath, [fixture, mode], { timeout: 20000, maxBuffer: 1024 * 1024 });
    assert.deepEqual(JSON.parse(stdout), {
      mode,
      initial: { candidates: ['flex'], files: ['source.html'], scannedFiles: ['source.html'] },
      unchanged: { candidates: ['flex'], files: ['source.html'], scannedFiles: [] },
      changed: { candidates: ['flex', 'grid'], files: ['source.html'], scannedFiles: ['source.html'] },
      added: { candidates: ['flex', 'grid', 'underline'], files: ['nested/added.html', 'source.html'], scannedFiles: ['nested/added.html'] },
    });
  });
}

test('published Tailwind Node declarations typecheck without hiding unrelated semantic errors', { timeout: 30000 }, async () => {
  const parent = path.join(client, '.tmp');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'tailwind-declarations-'));
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(parent));
  try {
    const source = path.join(directory, 'consumer.mts');
    const configuration = path.join(directory, 'tsconfig.json');
    const declarationConsumer = 'import { compile } from "@tailwindcss/node";\nconst compiler = await compile("@tailwind utilities;", { base: process.cwd(), onDependency() {} });\nconst css: string = compiler.build(["flex"]);\nvoid css;\n';
    await writeFile(configuration, JSON.stringify({
      compilerOptions: { strict: true, skipLibCheck: false, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', types: ['node'] },
      files: ['consumer.mts'],
    }));
    await writeFile(source, declarationConsumer);
    const executable = require.resolve('typescript/bin/tsc');
    const options = { cwd: directory, timeout: 20000, maxBuffer: 1024 * 1024 };
    const args = [executable, '--project', configuration, '--pretty', 'false'];
    const positive = await execute(process.execPath, args, options);
    assert.equal(positive.stdout, '');
    assert.equal(positive.stderr, '');
    await writeFile(source, `${declarationConsumer}const unrelated: number = "semantic sentinel";\nvoid unrelated;\n`);
    let rejected;
    try { await execute(process.execPath, args, options); } catch (error) { rejected = error; }
    assert.ok(rejected);
    assert.equal(rejected.code, 2);
    const diagnostics = rejected.stdout.trim().split(/\r?\n/u);
    assert.equal(diagnostics.length, 1);
    assert.match(diagnostics[0], /^consumer\.mts\(5,7\): error TS2322: Type 'string' is not assignable to type 'number'\.$/u);
    assert.equal(rejected.stderr, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
