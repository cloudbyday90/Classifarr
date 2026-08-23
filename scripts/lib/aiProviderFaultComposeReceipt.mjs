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

import fs from 'node:fs';
import { dirname, resolve } from 'node:path';

import { isAiProviderFaultComposeFailureStatusId } from './aiProviderFaultComposeContract.mjs';

export const AI_PROVIDER_FAULT_COMPOSE_RECEIPT_SCHEMA_VERSION =
  'classifarr.ai-provider-fault-compose-receipt.v1';
export const AI_PROVIDER_FAULT_COMPOSE_RECEIPT_TEST_CONTRACT =
  'isolated_provider_fault_compose_v1';
export const AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES = Object.freeze({
  FAILED: 'failed',
  PASSED: 'passed',
});
export const AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID = 'passed';
export const DEFAULT_AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PATH = resolve(
  import.meta.dirname,
  '../../.tmp/ci/ai-provider-fault-compose-receipt.json',
);

const SOURCE_REVISION_PATTERN = /^[a-f0-9]{40}$/u;
const ISO_8601_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function receiptError() {
  return new Error('AI provider fault Compose receipt is invalid.');
}

function assertExactKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw receiptError();
  }

  const expected = [
    'completed_at',
    'outcome',
    'schema_version',
    'source_revision',
    'status_id',
    'test_contract',
  ];
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw receiptError();
  }
}

function assertSourceRevision(sourceRevision) {
  if (typeof sourceRevision !== 'string' || !SOURCE_REVISION_PATTERN.test(sourceRevision)) {
    throw receiptError();
  }
}

function assertCompletedAt(completedAt) {
  if (
    typeof completedAt !== 'string' ||
    !ISO_8601_UTC_PATTERN.test(completedAt) ||
    Number.isNaN(Date.parse(completedAt)) ||
    new Date(completedAt).toISOString() !== completedAt
  ) {
    throw receiptError();
  }
}

function assertOutcomeAndStatusId({ outcome, statusId }) {
  if (outcome === AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.PASSED) {
    if (statusId !== AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID) {
      throw receiptError();
    }
    return;
  }

  if (
    outcome !== AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.FAILED ||
    !isAiProviderFaultComposeFailureStatusId(statusId)
  ) {
    throw receiptError();
  }
}

export function createAiProviderFaultComposeReceipt({
  completedAt = new Date().toISOString(),
  outcome,
  sourceRevision,
  statusId,
} = {}) {
  assertSourceRevision(sourceRevision);
  assertCompletedAt(completedAt);
  assertOutcomeAndStatusId({ outcome, statusId });

  return Object.freeze({
    completed_at: completedAt,
    outcome,
    schema_version: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_SCHEMA_VERSION,
    source_revision: sourceRevision,
    status_id: statusId,
    test_contract: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_TEST_CONTRACT,
  });
}

export function validateAiProviderFaultComposeReceipt(receipt) {
  assertExactKeys(receipt);
  if (
    receipt.schema_version !== AI_PROVIDER_FAULT_COMPOSE_RECEIPT_SCHEMA_VERSION ||
    receipt.test_contract !== AI_PROVIDER_FAULT_COMPOSE_RECEIPT_TEST_CONTRACT
  ) {
    throw receiptError();
  }

  return createAiProviderFaultComposeReceipt({
    completedAt: receipt.completed_at,
    outcome: receipt.outcome,
    sourceRevision: receipt.source_revision,
    statusId: receipt.status_id,
  });
}

export function writeAiProviderFaultComposeReceipt(receipt) {
  const normalizedReceipt = validateAiProviderFaultComposeReceipt(receipt);
  fs.mkdirSync(dirname(DEFAULT_AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PATH), {
    mode: 0o700,
    recursive: true,
  });
  fs.writeFileSync(
    DEFAULT_AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PATH,
    `${JSON.stringify(normalizedReceipt, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx', mode: 0o600 },
  );
  return DEFAULT_AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PATH;
}

export function readAiProviderFaultComposeReceipt() {
  let parsedReceipt;
  try {
    parsedReceipt = JSON.parse(fs.readFileSync(DEFAULT_AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PATH, 'utf8'));
  } catch (_error) {
    throw receiptError();
  }
  return validateAiProviderFaultComposeReceipt(parsedReceipt);
}
