/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const PG_STAT_STATEMENTS_COMMENT =
  '# Query statistics (optional pg_stat_statements extension)';

const SHARED_PRELOAD_LIBRARIES_PATTERN = /^\s*shared_preload_libraries\s*=/;
const PG_STAT_TRACK_PATTERN = /^\s*pg_stat_statements\.track\s*=/;
const PG_STAT_MAX_PATTERN = /^\s*pg_stat_statements\.max\s*=/;
const DYNAMIC_LIBRARY_PATH_PATTERN = /^(\s*dynamic_library_path\s*=\s*')(.*)('\s*)$/;

export function rewritePgStatStatementsConfigText(
  text,
  { enablePgss, appendIfMissing = enablePgss } = {}
) {
  const lines = String(text).split('\n');
  const retained = [];
  let existingLibraries = [];
  let sawPreloadLine = false;

  for (const line of lines) {
    if (
      SHARED_PRELOAD_LIBRARIES_PATTERN.test(line) &&
      !line.trimStart().startsWith('#')
    ) {
      sawPreloadLine = true;
      const match = line.match(/=\s*'(.*)'\s*$/);
      if (match) {
        existingLibraries = match[1]
          .split(',')
          .map(entry => entry.trim())
          .filter(Boolean);
      }
      continue;
    }

    if (line.trim() === PG_STAT_STATEMENTS_COMMENT) {
      continue;
    }

    if (
      !line.trimStart().startsWith('#') &&
      (PG_STAT_TRACK_PATTERN.test(line) || PG_STAT_MAX_PATTERN.test(line))
    ) {
      continue;
    }

    retained.push(line);
  }

  const withoutPgss = existingLibraries.filter(entry => entry !== 'pg_stat_statements');
  const finalLibraries = enablePgss ? [...withoutPgss, 'pg_stat_statements'] : withoutPgss;
  const normalizedLibraries = [];
  for (const library of finalLibraries) {
    if (!normalizedLibraries.includes(library)) {
      normalizedLibraries.push(library);
    }
  }

  const shouldWritePgssSettings = sawPreloadLine || appendIfMissing;

  if (shouldWritePgssSettings) {
    retained.push(PG_STAT_STATEMENTS_COMMENT);
    retained.push(`shared_preload_libraries = '${normalizedLibraries.join(', ')}'`);
  }

  if (enablePgss && shouldWritePgssSettings) {
    retained.push('pg_stat_statements.track = all');
    retained.push('pg_stat_statements.max = 10000');
  }

  return retained.join('\n');
}

export function normalizeDynamicLibraryPathValue(rawPath, { stagingPath = '' } = {}) {
  const entries = String(rawPath)
    .split(/[:,]/)
    .map(entry => entry.trim())
    .filter(Boolean);
  const normalizedEntries = [];

  if (stagingPath) {
    normalizedEntries.push(stagingPath);
  }

  for (const entry of entries) {
    if (entry !== stagingPath && !normalizedEntries.includes(entry)) {
      normalizedEntries.push(entry);
    }
  }

  return normalizedEntries.join(':');
}

export function normalizeDynamicLibraryPathText(text, { stagingPath = '' } = {}) {
  return String(text)
    .split('\n')
    .map(line => {
      const match = line.match(DYNAMIC_LIBRARY_PATH_PATTERN);
      if (!match) {
        return line;
      }

      const [, prefix, rawPath, suffix] = match;
      const normalizedPath = normalizeDynamicLibraryPathValue(rawPath, { stagingPath });
      return `${prefix}${normalizedPath}${suffix}`;
    })
    .join('\n');
}
