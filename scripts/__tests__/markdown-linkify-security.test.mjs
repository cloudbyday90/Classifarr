/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { findPackageJSON } from 'node:module';
import { test } from 'node:test';
import MarkdownIt from 'markdown-it';
import { lint } from 'markdownlint-cli2/markdownlint/promise';
import { observeMarkdownLinkification } from './helpers/observeMarkdownLinkification.mjs';

test('the regression and CLI share the root parser with a compatible ESM linkifier', () => {
  assert.equal(
    findPackageJSON('markdown-it', import.meta.url),
    findPackageJSON('markdown-it', import.meta.resolve('markdownlint-cli2')),
  );
  const md = new MarkdownIt();
  assert.equal(typeof md.linkify.pretest, 'function');
  assert.equal(md.render('# Ready\n'), '<h1>Ready</h1>\n');
});

for (const count of [16, 32]) {
  for (const line of ['a@b.co\n', 'ping a@b.co ok\n']) {
    test(`email softbreaks rebuild tokens once (${count}, ${line.trim()})`, (context) => {
      const md = new MarkdownIt({ linkify: true });
      const metrics = observeMarkdownLinkification(md);
      const output = md.render(line.repeat(count));
      const expectedLine = line.replace('a@b.co', '<a href="mailto:a@b.co">a@b.co</a>');
      assert.equal(output, `<p>${expectedLine.repeat(count).trimEnd()}</p>\n`);
      assert.equal(metrics.blocks, 1);
      context.diagnostic(JSON.stringify(metrics));
      assert.ok(metrics.writes <= 1, `Repeated token-array reconstruction: ${metrics.writes}`);
      assert.ok(metrics.writtenTokens <= count * 6, `Excess token copying: ${metrics.writtenTokens}`);
    });
  }

  for (const scheme of ['a://', 'unknown+1://']) {
    test(`unknown schemes do not rescan growing prefixes (${count}, ${scheme})`, (context) => {
      const md = new MarkdownIt({ linkify: true });
      const metrics = observeMarkdownLinkification(md);
      const source = scheme.repeat(count);
      assert.equal(md.render(source), `<p>${source}</p>\n`);
      assert.ok(metrics.candidates >= count, 'Inline linkification was not exercised');
      context.diagnostic(JSON.stringify(metrics));
      assert.ok(
        metrics.scannedCharacters <= metrics.candidates * 10,
        `Growing-prefix regex scans: ${metrics.scannedCharacters} characters`,
      );
    });
  }
}

test('descriptive links, HTTPS, email and code spans retain their output', () => {
  const md = new MarkdownIt({ linkify: true });
  assert.equal(
    md.render('[Review retry settings](/settings) https://example.test/path a@b.co `a@b.co`\n'),
    '<p><a href="/settings">Review retry settings</a> <a href="https://example.test/path">https://example.test/path</a> <a href="mailto:a@b.co">a@b.co</a> <code>a@b.co</code></p>\n',
  );
});

test('disabled linkification and existing HTML links keep their semantics', () => {
  assert.equal(new MarkdownIt().render('a@b.co\n'), '<p>a@b.co</p>\n');
  assert.equal(
    new MarkdownIt({ linkify: true, html: true }).render('<a href="/help">a@b.co</a>\n'),
    '<p><a href="/help">a@b.co</a></p>\n',
  );
});

test('unsafe destinations and raw HTML remain untrusted under default options', () => {
  const md = new MarkdownIt({ linkify: true });
  assert.equal(md.render('[bad](javascript:alert(1))\n'), '<p>[bad](javascript:alert(1))</p>\n');
  assert.equal(md.render('<script>alert(1)</script>\n'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n');
});

test('ordinary smart quotes still work with the security backport', () => {
  assert.equal(new MarkdownIt({ typographer: true }).render('"Hello" and \'world\'.\n'), '<p>“Hello” and ‘world’.</p>\n');
});

test('markdownlint custom rules actually instantiate and consume the ESM parser', async () => {
  let factoryCalls = 0;
  let ruleCalls = 0;
  const result = await lint({
    strings: { sample: '# Ready\n\nContact a@b.co.\n' },
    config: { default: false, 'root-parser-smoke': true },
    markdownItFactory: () => {
      factoryCalls++;
      return new MarkdownIt({ html: true, linkify: true });
    },
    customRules: [{
      names: ['root-parser-smoke'],
      description: 'Verify the root Markdown parser integration',
      tags: ['root-tooling'],
      parser: 'markdownit',
      function(params) {
        ruleCalls++;
        const tokens = params.parsers.markdownit.tokens;
        assert.ok(tokens.some(({ type }) => type === 'heading_open'));
        assert.ok(tokens.some(({ children }) => children?.some(
          ({ type, attrs }) => type === 'link_open' && attrs?.some(([name, value]) => name === 'href' && value === 'mailto:a@b.co'),
        )));
      },
    }],
  });
  assert.equal(factoryCalls, 1);
  assert.equal(ruleCalls, 1);
  assert.deepEqual(result.sample, []);
});
