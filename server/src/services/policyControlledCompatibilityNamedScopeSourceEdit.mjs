/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_VERSION =
  'policy.controlled_compatibility_named_scope_source_edit.v1';

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS = Object.freeze({
  SOURCE_FRAGMENT_MISSING: 'source_fragment_missing',
  TEST_DECLARATION_UNSUPPORTED: 'test_declaration_unsupported',
  TEST_NAME_MISSING: 'test_name_missing',
  TEST_NAME_AMBIGUOUS: 'test_name_ambiguous',
  TEST_SCOPE_OVERLAP: 'test_scope_overlap',
  TEST_SCOPE_TRAILING_CODE: 'test_scope_trailing_code',
});

const TEST_DECLARATION_START_PATTERN = /(?:^|\n)[\t ]*(it|test)\b/gu;
const TEST_MODIFIER_NAMES = new Set(['concurrent', 'failing', 'only', 'skip', 'todo']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))];
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function buildSha256(value = '') {
  return createHash('sha256').update(value).digest('hex');
}

function skipQuotedLiteral(sourceText, startIndex, quote) {
  let index = startIndex + 1;

  while (index < sourceText.length) {
    if (sourceText[index] === '\\') {
      index += 2;
      continue;
    }
    if (sourceText[index] === quote) return index + 1;
    index += 1;
  }

  return sourceText.length;
}

function skipLineComment(sourceText, startIndex) {
  const lineEnd = sourceText.indexOf('\n', startIndex + 2);

  return lineEnd === -1 ? sourceText.length : lineEnd;
}

function skipBlockComment(sourceText, startIndex) {
  const commentEnd = sourceText.indexOf('*/', startIndex + 2);

  return commentEnd === -1 ? sourceText.length : commentEnd + 2;
}

function isRegexPrefix(sourceText, slashIndex) {
  let index = slashIndex - 1;

  while (index >= 0 && /\s/u.test(sourceText[index])) index -= 1;
  if (index < 0) return true;

  return '([{:;,=!&|?~+-*%^<>'.includes(sourceText[index]);
}

function skipRegexLiteral(sourceText, startIndex) {
  let index = startIndex + 1;
  let insideCharacterClass = false;

  while (index < sourceText.length) {
    const character = sourceText[index];

    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === '[') insideCharacterClass = true;
    if (character === ']') insideCharacterClass = false;
    if (character === '/' && !insideCharacterClass) {
      index += 1;
      while (/[a-z]/iu.test(sourceText[index] || '')) index += 1;
      return index;
    }
    if (character === '\n' || character === '\r') return index;
    index += 1;
  }

  return sourceText.length;
}

function createJavaScriptCodeMask(sourceText = '') {
  const mask = sourceText.split('');
  let index = 0;

  function maskRange(startIndex, endIndex) {
    for (let cursor = startIndex; cursor < endIndex; cursor += 1) {
      if (mask[cursor] !== '\n' && mask[cursor] !== '\r') mask[cursor] = ' ';
    }
  }

  while (index < sourceText.length) {
    const character = sourceText[index];
    const nextCharacter = sourceText[index + 1];
    let endIndex = index;

    if (character === "'" || character === '"' || character === '`') {
      endIndex = skipQuotedLiteral(sourceText, index, character);
    } else if (character === '/' && nextCharacter === '/') {
      endIndex = skipLineComment(sourceText, index);
    } else if (character === '/' && nextCharacter === '*') {
      endIndex = skipBlockComment(sourceText, index);
    } else if (character === '/' && isRegexPrefix(sourceText, index)) {
      endIndex = skipRegexLiteral(sourceText, index);
    } else {
      index += 1;
      continue;
    }

    maskRange(index, endIndex);
    index = endIndex;
  }

  return mask.join('');
}

function skipWhitespaceAndComments(sourceText, startIndex) {
  let index = startIndex;

  while (index < sourceText.length) {
    if (/\s/u.test(sourceText[index])) {
      index += 1;
      continue;
    }
    if (sourceText.startsWith('//', index)) {
      index = skipLineComment(sourceText, index);
      continue;
    }
    if (sourceText.startsWith('/*', index)) {
      index = skipBlockComment(sourceText, index);
      continue;
    }
    return index;
  }

  return index;
}

function skipWhitespace(sourceText, startIndex) {
  let index = startIndex;

  while (index < sourceText.length && /\s/u.test(sourceText[index])) index += 1;

  return index;
}

function readIdentifier(sourceText, startIndex) {
  const match = /^[A-Za-z_$][A-Za-z0-9_$]*/u.exec(sourceText.slice(startIndex));

  return match
    ? { endIndex: startIndex + match[0].length, value: match[0] }
    : null;
}

function findTestOpeningParenthesis(sourceText, afterTestNameIndex) {
  let index = skipWhitespace(sourceText, afterTestNameIndex);

  while (sourceText[index] === '.') {
    const modifier = readIdentifier(sourceText, skipWhitespace(sourceText, index + 1));

    if (!modifier || !TEST_MODIFIER_NAMES.has(modifier.value)) return null;
    index = skipWhitespace(sourceText, modifier.endIndex);
  }

  return sourceText[index] === '(' ? index : null;
}

function readStringLiteral(sourceText, startIndex) {
  const quote = sourceText[startIndex];

  if (quote !== "'" && quote !== '"') return null;

  let index = startIndex + 1;
  let value = '';

  while (index < sourceText.length) {
    const character = sourceText[index];

    if (character === '\\') {
      const escapedCharacter = sourceText[index + 1];

      if (escapedCharacter === undefined) return null;
      value += escapedCharacter;
      index += 2;
      continue;
    }
    if (character === quote) {
      return {
        endIndex: index + 1,
        value,
      };
    }
    if (character === '\n' || character === '\r') return null;

    value += character;
    index += 1;
  }

  return null;
}

function findMatchingParenthesis(sourceText, openingParenthesisIndex) {
  let depth = 1;
  let index = openingParenthesisIndex + 1;

  while (index < sourceText.length) {
    const character = sourceText[index];
    const nextCharacter = sourceText[index + 1];

    if (character === "'" || character === '"' || character === '`') {
      index = skipQuotedLiteral(sourceText, index, character);
      continue;
    }
    if (character === '/' && nextCharacter === '/') {
      index = skipLineComment(sourceText, index);
      continue;
    }
    if (character === '/' && nextCharacter === '*') {
      index = skipBlockComment(sourceText, index);
      continue;
    }
    if (character === '/' && isRegexPrefix(sourceText, index)) {
      index = skipRegexLiteral(sourceText, index);
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }

  return null;
}

function findLineStart(sourceText, index) {
  const previousLineBreak = sourceText.lastIndexOf('\n', Math.max(index - 1, 0));

  return previousLineBreak === -1 ? 0 : previousLineBreak + 1;
}

function findRemovableDeclarationEnd(sourceText, closingParenthesisIndex) {
  let index = closingParenthesisIndex + 1;

  if (sourceText[index] === ';') index += 1;

  const lineEnd = sourceText.indexOf('\n', index);
  const beforeLineEnd = lineEnd === -1 ? sourceText.slice(index) : sourceText.slice(index, lineEnd);

  if (beforeLineEnd.trim()) return null;

  return lineEnd === -1 ? sourceText.length : lineEnd + 1;
}

function findNamedTestDeclarations(sourceText = '') {
  const codeMask = createJavaScriptCodeMask(sourceText);
  const declarations = [];

  TEST_DECLARATION_START_PATTERN.lastIndex = 0;
  while (TEST_DECLARATION_START_PATTERN.exec(codeMask) !== null) {
    const testNameEndIndex = TEST_DECLARATION_START_PATTERN.lastIndex;
    const openingParenthesisIndex = findTestOpeningParenthesis(codeMask, testNameEndIndex);

    if (openingParenthesisIndex === null) continue;

    const argumentStartIndex = skipWhitespaceAndComments(sourceText, openingParenthesisIndex + 1);
    const nameLiteral = readStringLiteral(sourceText, argumentStartIndex);
    const lineStart = findLineStart(sourceText, openingParenthesisIndex);
    const closingParenthesisIndex = findMatchingParenthesis(sourceText, openingParenthesisIndex);

    if (!nameLiteral || closingParenthesisIndex === null) {
      declarations.push({
        endIndex: null,
        name: null,
        startIndex: lineStart,
        unsupported: true,
      });
      continue;
    }

    const endIndex = findRemovableDeclarationEnd(sourceText, closingParenthesisIndex);

    declarations.push({
      endIndex,
      name: nameLiteral.value,
      startIndex: lineStart,
      unsupported: endIndex === null,
    });
  }

  return declarations;
}

function countOccurrences(sourceText = '', fragment = '') {
  if (!fragment) return 0;

  let count = 0;
  let index = 0;

  while (index < sourceText.length) {
    const occurrenceIndex = sourceText.indexOf(fragment, index);

    if (occurrenceIndex === -1) break;
    count += 1;
    index = occurrenceIndex + fragment.length;
  }

  return count;
}

function applySourceEdits(sourceText = '', edits = []) {
  return [...edits]
    .sort((left, right) => right.startOffset - left.startOffset)
    .reduce((result, edit) => (
      `${result.slice(0, edit.startOffset)}${result.slice(edit.endOffset)}`
    ), sourceText);
}

function derivePolicyControlledCompatibilityNamedScopeSourceEdit({
  sourceText = '',
  sourceTextFragments = [],
  testNameFragments = [],
} = {}) {
  const source = typeof sourceText === 'string' ? sourceText : '';
  const requiredSourceFragments = uniqueStrings(sourceTextFragments);
  const requiredTestNames = uniqueStrings(testNameFragments);
  const sourceFragments = requiredSourceFragments.map(fragment => ({
    fragment,
    occurrenceCount: countOccurrences(source, fragment),
  }));
  const declarations = findNamedTestDeclarations(source);
  const risks = [];

  sourceFragments
    .filter(fragment => fragment.occurrenceCount === 0)
    .forEach(fragment => {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS.SOURCE_FRAGMENT_MISSING,
        'The retained test file no longer contains an approved named-scope source fragment.',
        { fragment: fragment.fragment }
      ));
    });

  const selectedDeclarations = requiredTestNames.flatMap(testName => {
    const matches = declarations.filter(declaration => declaration.name === testName);

    if (matches.length === 0) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS.TEST_NAME_MISSING,
        'The retained test file no longer contains an approved exact test name.',
        { testName }
      ));
      return [];
    }
    if (matches.length > 1) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS.TEST_NAME_AMBIGUOUS,
        'The retained test file contains multiple declarations for an approved test name.',
        { testName, occurrenceCount: matches.length }
      ));
      return [];
    }
    if (matches[0].unsupported) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS.TEST_DECLARATION_UNSUPPORTED,
        'The approved test declaration cannot be bounded safely for a dry-run source edit.',
        { testName }
      ));
      return [];
    }

    return [{ ...matches[0], testName }];
  });

  const edits = selectedDeclarations
    .sort((left, right) => left.startIndex - right.startIndex)
    .map(declaration => ({
      endOffset: declaration.endIndex,
      expectedTextFingerprint: buildSha256(source.slice(
        declaration.startIndex,
        declaration.endIndex
      )),
      startOffset: declaration.startIndex,
      testName: declaration.testName,
    }));

  edits.forEach((edit, index) => {
    const nextEdit = edits[index + 1];

    if (nextEdit && edit.endOffset > nextEdit.startOffset) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS.TEST_SCOPE_OVERLAP,
        'Approved named test scopes overlap and cannot be removed as independent source edits.',
        { firstTestName: edit.testName, secondTestName: nextEdit.testName }
      ));
    }
  });

  const sourceFingerprint = buildSha256(source);
  const resultSourceText = risks.length === 0 ? applySourceEdits(source, edits) : null;

  return {
    version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_VERSION,
    ready: risks.length === 0,
    source: {
      byteLength: Buffer.byteLength(source),
      fingerprint: sourceFingerprint,
      sourceFragmentObservations: sourceFragments,
    },
    dryRun: risks.length === 0 ? {
      editCount: edits.length,
      edits,
      operationId: 'remove_named_test_scope',
      resultFingerprint: buildSha256(resultSourceText),
      sourceFingerprint,
    } : null,
    riskCount: risks.length,
    risks,
  };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_VERSION,
  derivePolicyControlledCompatibilityNamedScopeSourceEdit,
  findNamedTestDeclarations,
};
