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

import {
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES,
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_SCHEMA_VERSION,
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_TEST_CONTRACT,
  createAiProviderFaultComposeReceiptFingerprint,
  createAiProviderFaultComposeReceipt,
  validateAiProviderFaultComposeReceipt,
} from '../../../../scripts/lib/aiProviderFaultComposeReceipt.mjs';
import { AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS } from '../../../../scripts/lib/aiProviderFaultComposeContract.mjs';

const SOURCE_REVISION = 'a'.repeat(40);
const COMPLETED_AT = '2026-08-22T12:34:56.789Z';

describe('aiProviderFaultComposeReceipt', () => {
  test('creates a fixed, bounded passing receipt', () => {
    expect(createAiProviderFaultComposeReceipt({
      completedAt: COMPLETED_AT,
      outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.PASSED,
      sourceRevision: SOURCE_REVISION,
      statusId: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
    })).toEqual({
      completed_at: COMPLETED_AT,
      outcome: 'passed',
      schema_version: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_SCHEMA_VERSION,
      source_revision: SOURCE_REVISION,
      status_id: 'passed',
      test_contract: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_TEST_CONTRACT,
    });
  });

  test('permits only a fixed failure status vocabulary', () => {
    expect(createAiProviderFaultComposeReceipt({
      completedAt: COMPLETED_AT,
      outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.FAILED,
      sourceRevision: SOURCE_REVISION,
      statusId: AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.TEST_FAILED,
    }).status_id).toBe(AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.TEST_FAILED);

    expect(() => createAiProviderFaultComposeReceipt({
      completedAt: COMPLETED_AT,
      outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.FAILED,
      sourceRevision: SOURCE_REVISION,
      statusId: 'connection to provider at http://untrusted.example failed',
    })).toThrow('AI provider fault Compose receipt is invalid.');
  });

  test('rejects receipt expansion and inconsistent outcome values', () => {
    const receipt = createAiProviderFaultComposeReceipt({
      completedAt: COMPLETED_AT,
      outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.PASSED,
      sourceRevision: SOURCE_REVISION,
      statusId: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
    });

    expect(() => validateAiProviderFaultComposeReceipt({
      ...receipt,
      provider_response: 'raw response must not be retained',
    })).toThrow('AI provider fault Compose receipt is invalid.');
    expect(() => validateAiProviderFaultComposeReceipt({
      ...receipt,
      outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.FAILED,
    })).toThrow('AI provider fault Compose receipt is invalid.');
  });

  test('fingerprints normalized receipt semantics independently of input key order', () => {
    const receipt = createAiProviderFaultComposeReceipt({
      completedAt: COMPLETED_AT,
      outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.PASSED,
      sourceRevision: SOURCE_REVISION,
      statusId: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
    });
    const reorderedReceipt = {
      test_contract: receipt.test_contract,
      status_id: receipt.status_id,
      source_revision: receipt.source_revision,
      schema_version: receipt.schema_version,
      outcome: receipt.outcome,
      completed_at: receipt.completed_at,
    };

    expect(createAiProviderFaultComposeReceiptFingerprint(reorderedReceipt)).toEqual({
      algorithm: 'sha256',
      value: createAiProviderFaultComposeReceiptFingerprint(receipt).value,
    });
  });
});
