/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import katex from 'katex';
import { micromark } from 'micromark';
import { math, mathHtml } from 'micromark-extension-math';
import { lint } from 'markdownlint/promise';

const link = String.raw`\href{javascript:alert(1)}{x}`;

function withPrototypeProperty(key, value, operation) {
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, key);
  try {
    Object.defineProperty(Object.prototype, key, { value, configurable: true, writable: true });
    return operation();
  } finally {
    if (previous) Object.defineProperty(Object.prototype, key, previous);
    else delete Object.prototype[key];
  }
}

test('KaTeX ignores trust inherited from the options object', () => {
  assert.doesNotMatch(katex.renderToString(link, Object.create({ trust: true })), /\bhref=/);
});

for (const [name, expression, forbidden] of [
  ['link', link, /\bhref=/],
  ['image', String.raw`\includegraphics{https://example.test/image.png}`, /\bsrc=/],
]) {
  test(`KaTeX ignores polluted global trust: ${name}`, () => {
    const html = withPrototypeProperty('trust', true, () => katex.renderToString(expression));
    assert.doesNotMatch(html, forbidden);
  });
}

test('KaTeX ignores inherited setting defaults', () => {
  const ordinary = katex.renderToString(link);
  assert.equal(withPrototypeProperty('default', true, () => katex.renderToString(link)), ordinary);
});

test('KaTeX ignores inherited setting processors', () => {
  const ordinary = katex.renderToString(link);
  assert.equal(withPrototypeProperty('processor', () => true,
    () => katex.renderToString(link, { trust: false })), ordinary);
});

for (const expression of [String.raw`\cfInspectNamespace`, String.raw`{\def\cfInherited{x}}\cfInspectNamespace`]) {
  test(`KaTeX does not import or restore an inherited macro: ${expression}`, () => {
    // Observe the macro namespace through the supported function-valued macro
    // API. Parsing the polluted name as a command also hits the separate
    // function/symbol registries, which is not a namespace-isolation assertion.
    let observed = 'not called';
    const html = withPrototypeProperty('\\cfInherited', 'y', () => katex.renderToString(expression, {
      macros: {
        '\\cfInspectNamespace': context => {
          observed = context.macros.get('\\cfInherited');
          return 'z';
        },
      },
    }));
    assert.equal(observed, undefined);
    assert.match(html, /<mi(?: [^>]*)?>z<\/mi>/);
  });
}

test('explicit trusted rendering and own macros still work', () => {
  const html = katex.renderToString(String.raw`\href{https://example.test/}{\cfOwn}`, {
    trust: true, macros: { '\\cfOwn': 'x' },
  });
  assert.match(html, /<a href="https:\/\/example\.test\/"/);
  assert.match(html, /<mi(?: [^>]*)?>x<\/mi>/);
  assert.throws(() => katex.renderToString(String.raw`\undefinedCommand`), /Undefined control sequence/);
});

test('micromark retains inline/display math and its untrusted-rendering default', () => {
  const html = micromark('$x^2$\n\n$$\nx + y\n$$\n', {
    extensions: [math()], htmlExtensions: [mathHtml()],
  });
  assert.match(html, /class="math math-inline"/);
  assert.match(html, /class="math math-display"/);
  assert.match(html, /<math /);
  const untrusted = micromark(`$${link}$`, { extensions: [math()], htmlExtensions: [mathHtml()] });
  assert.doesNotMatch(untrusted, /\bhref=/);
});

test('Markdown lint still treats math as syntax and reports errors outside it', async () => {
  const result = await lint({
    strings: { math: '$x + (text)[url]$\n\n$$\n\\undefinedCommand\n$$\n', ordinary: '(text)[url]\n' },
    config: { default: false, MD011: true, MD047: true },
  });
  assert.deepEqual(result.math, []);
  assert.equal(result.ordinary.length, 1);
  assert.equal(result.ordinary[0].ruleNames[0], 'MD011');
});
