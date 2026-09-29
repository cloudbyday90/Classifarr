/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';

// Observe the two reported work mechanisms on a dedicated parser instance.
// No dependency source or global prototypes are patched; output stays real.
export function observeMarkdownLinkification(md) {
  const metrics = { blocks: 0, writes: 0, writtenTokens: 0, candidates: 0, scannedCharacters: 0 };
  const coreRule = md.core.ruler.getRules('').find((rule) => rule.name === 'linkify');
  const inlineRule = md.inline.ruler.getRules('').find((rule) => rule.name === 'linkify');
  assert.equal(typeof coreRule, 'function');
  assert.equal(typeof inlineRule, 'function');

  md.core.ruler.at('linkify', (state) => {
    const restorers = [];
    for (const block of state.tokens) {
      if (block.type !== 'inline') continue;
      metrics.blocks++;
      const descriptor = Object.getOwnPropertyDescriptor(block, 'children');
      let children = block.children;
      Object.defineProperty(block, 'children', {
        configurable: true,
        get: () => children,
        set(value) {
          metrics.writes++;
          metrics.writtenTokens += value.length;
          children = value;
        },
      });
      restorers.push(() => Object.defineProperty(block, 'children', { ...descriptor, value: children }));
    }
    try {
      return coreRule(state);
    } finally {
      for (const restore of restorers) restore();
    }
  });

  md.inline.ruler.at('linkify', (state, silent) => {
    if (!state.src.startsWith('://', state.pos)) return inlineRule(state, silent);
    metrics.candidates++;
    const pending = state.pending;
    // A local boxed string retains normal length/slice/coercion semantics while
    // exposing the vulnerable rule's regex scan input length deterministically.
    const observed = new String(pending);
    observed.match = (pattern) => {
      metrics.scannedCharacters += pending.length;
      return pending.match(pattern);
    };
    state.pending = observed;
    try {
      return inlineRule(state, silent);
    } finally {
      if (state.pending === observed) state.pending = pending;
    }
  });

  return metrics;
}
