/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Intentionally a small dialect: literals, *, ?, and whole-segment ** only.
// No brace expansion, extglobs, regular expressions, negation or parent paths.
export function validatePatterns(patterns, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(patterns) || patterns.length > 128 || (!allowEmpty && !patterns.length)) {
    throw new Error(`${label} must contain ${allowEmpty ? '0' : '1'} to 128 patterns`);
  }
  for (const pattern of patterns) {
    if (typeof pattern !== 'string' || !pattern.length || pattern.length > 512 ||
        /[\\{}()[\]!:<>|\x00-\x1f]/u.test(pattern) || pattern.startsWith('-') ||
        pattern.split('/').some(part => !part || part === '.' || part === '..' ||
          (part.includes('**') && part !== '**'))) {
      throw new Error(`${label} contains an unsupported repository-relative pattern`);
    }
  }
  return patterns;
}

function matchSegment(pattern, value) {
  let p = 0;
  let v = 0;
  let star = -1;
  let retry = 0;
  while (v < value.length) {
    if (pattern[p] === '*') { star = p++; retry = v; }
    else if (pattern[p] === '?' || pattern[p] === value[v]) { p++; v++; }
    else if (star !== -1) { p = star + 1; v = ++retry; }
    else return false;
  }
  while (pattern[p] === '*') p++;
  return p === pattern.length;
}

// Iterative matching avoids both recursive AST walks and regex backtracking.
// Matching stays case-sensitive on every platform, including Windows.
export function matchesPattern(pattern, path) {
  const parts = path.split('/');
  let previous = [true, ...parts.map(() => false)];
  for (const segment of pattern.split('/')) {
    const next = [segment === '**' && previous[0]];
    for (let index = 1; index <= parts.length; index++) {
      next[index] = segment === '**'
        ? previous[index] || next[index - 1]
        : previous[index - 1] && matchSegment(segment, parts[index - 1]);
    }
    previous = next;
  }
  return previous[parts.length];
}
