/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  validateAiClassificationEvaluationFixture,
} from '../../server/src/services/aiClassificationEvaluationFixtureContract.mjs';

const LEGACY_FIXTURE_KEYS = Object.freeze([
  'media_type',
  'name',
  'title',
  'tmdb_id',
]);
const LEGACY_MEDIA_TYPES = new Set(['movie', 'tv']);
const MAX_LEGACY_TEXT_LENGTH = 240;

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasSafeText(value) {
  return typeof value === 'string' && value.trim().length > 0 &&
    value.length <= MAX_LEGACY_TEXT_LENGTH && !/[\u0000-\u001F\u007F]/u.test(value);
}

function buildIssue(id, path, message) {
  return { id, path, message };
}

function validateLegacyFixture(fixture, index) {
  const path = `fixtures[${index}]`;
  const issues = [];
  if (!isPlainRecord(fixture)) {
    return [buildIssue('invalid_legacy_fixture', path, 'Legacy fixture must be a JSON object.')];
  }

  for (const key of Object.keys(fixture)) {
    if (!LEGACY_FIXTURE_KEYS.includes(key)) {
      issues.push(buildIssue('unknown_legacy_fixture_field', `${path}.${key}`, 'Field is not supported by the legacy local-sweep fixture shape.'));
    }
  }
  if (!hasSafeText(fixture.name)) {
    issues.push(buildIssue('invalid_legacy_fixture_name', `${path}.name`, 'Name must be non-empty, bounded text without control characters.'));
  }
  if (!Number.isSafeInteger(fixture.tmdb_id) || fixture.tmdb_id < 1 || fixture.tmdb_id > 2147483647) {
    issues.push(buildIssue('invalid_legacy_fixture_tmdb_id', `${path}.tmdb_id`, 'TMDB ID must be a positive 32-bit integer.'));
  }
  if (!LEGACY_MEDIA_TYPES.has(fixture.media_type)) {
    issues.push(buildIssue('invalid_legacy_fixture_media_type', `${path}.media_type`, 'Media type must be movie or tv.'));
  }
  if (!hasSafeText(fixture.title)) {
    issues.push(buildIssue('invalid_legacy_fixture_title', `${path}.title`, 'Title must be non-empty, bounded text without control characters.'));
  }
  return issues;
}

function isVersionedFixtureCandidate(fixture) {
  return isPlainRecord(fixture) && Object.hasOwn(fixture, 'version');
}

function validateAiPolicySweepFixtureDocument(document) {
  const issues = [];
  if (!Array.isArray(document) || document.length === 0) {
    return {
      ok: false,
      evaluationFixtureCount: 0,
      issues: [buildIssue('invalid_fixture_document', 'fixtures', 'Fixture document must be a non-empty JSON array.')],
    };
  }

  const versionedIds = new Set();
  let evaluationFixtureCount = 0;
  document.forEach((fixture, index) => {
    if (!isVersionedFixtureCandidate(fixture)) {
      issues.push(...validateLegacyFixture(fixture, index));
      return;
    }

    evaluationFixtureCount += 1;
    const validation = validateAiClassificationEvaluationFixture(fixture);
    for (const issue of validation.issues) {
      const relativePath = issue.path.replace(/^fixture\.?/u, '');
      issues.push(buildIssue(issue.riskId, `fixtures[${index}]${relativePath ? `.${relativePath}` : ''}`, issue.message));
    }
    if (validation.ok && versionedIds.has(fixture.id)) {
      issues.push(buildIssue('duplicate_evaluation_fixture_id', `fixtures[${index}].id`, 'Versioned evaluation fixture IDs must be unique within a sweep document.'));
    }
    if (validation.ok) versionedIds.add(fixture.id);
  });

  return {
    ok: issues.length === 0,
    evaluationFixtureCount,
    issues,
  };
}

export {
  isVersionedFixtureCandidate,
  validateAiPolicySweepFixtureDocument,
};
