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

const DELIVERY_TERM_MATCHERS = Object.freeze([
  {
    matcherId: 'phase_label',
    pattern: /\bphase[\s._-]*(?:[0-9]+(?:R)?|R[0-9]+)\b/gi,
  },
  {
    matcherId: 'phase_code',
    pattern: /\b(?:0R|1R|2R|3R|4R|5R|6R|7R|8R|9R|R6)\b/g,
  },
  {
    matcherId: 'roadmap_identifier',
    pattern: /\b[A-Z_$][A-Z0-9_$]*(?:PHASE(?:[0-9]+R?|R[0-9]+))[A-Z0-9_$]*\b/gi,
  },
]);

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function overlaps(existing, candidate) {
  return (
    candidate.index >= existing.index &&
    candidate.index < existing.index + existing.token.length
  );
}

function findDeliveryTermMatches(content) {
  const source = typeof content === 'string' ? content : '';
  const findings = DELIVERY_TERM_MATCHERS.flatMap(({ matcherId, pattern }) => {
    const matcher = new RegExp(pattern.source, pattern.flags);
    const matches = [];
    let match = matcher.exec(source);

    while (match) {
      matches.push({
        matcherId,
        token: match[0],
        index: match.index,
        lineNumber: lineNumberAt(source, match.index),
      });
      match = matcher.exec(source);
    }

    return matches;
  });

  return findings
    .sort((left, right) => (
      left.index === right.index
        ? right.token.length - left.token.length
        : left.index - right.index
    ))
    .reduce((accepted, finding) => (
      accepted.some(existing => overlaps(existing, finding))
        ? accepted
        : [...accepted, finding]
    ), []);
}

export {
  DELIVERY_TERM_MATCHERS,
  findDeliveryTermMatches,
};
