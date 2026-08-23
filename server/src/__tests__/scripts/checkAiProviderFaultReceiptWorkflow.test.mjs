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
  AI_PROVIDER_FAULT_RECEIPT_ARTIFACT_NAME,
  AI_PROVIDER_FAULT_RECEIPT_PATH,
  loadWorkflow,
  validateAiProviderFaultReceiptWorkflow,
} from '../../scripts/checkAiProviderFaultReceiptWorkflow.mjs';

describe('checkAiProviderFaultReceiptWorkflow', () => {
  test('accepts the checked-in clean-host receipt gate', () => {
    expect(validateAiProviderFaultReceiptWorkflow(loadWorkflow())).toEqual({
      artifact: AI_PROVIDER_FAULT_RECEIPT_ARTIFACT_NAME,
      receiptPath: AI_PROVIDER_FAULT_RECEIPT_PATH,
    });
  });

  test('rejects an unpinned checkout that persists credentials', () => {
    const workflow = structuredClone(loadWorkflow());
    workflow.jobs['release-candidate-provider-fault-receipt'].steps[0].with = {
      'persist-credentials': true,
    };

    expect(() => validateAiProviderFaultReceiptWorkflow(workflow))
      .toThrow('release-candidate-provider-fault-receipt Checkout code.with.persist-credentials');
  });

  test('rejects a receipt job that can read release secrets', () => {
    const workflow = structuredClone(loadWorkflow());
    workflow.jobs['release-candidate-provider-fault-receipt'].steps[4].env.SECRET =
      '${{ secrets.DOCKERHUB_TOKEN }}';

    expect(() => validateAiProviderFaultReceiptWorkflow(workflow))
      .toThrow('release-candidate-provider-fault-receipt must not access secrets.');
  });

  test('rejects an artifact upload that retains unbounded files', () => {
    const workflow = structuredClone(loadWorkflow());
    const uploadStep = workflow.jobs['release-candidate-provider-fault-receipt'].steps.find(
      step => step.name === 'Upload bounded AI provider fault receipt',
    );
    uploadStep.with.path = '.tmp/ci/';

    expect(() => validateAiProviderFaultReceiptWorkflow(workflow))
      .toThrow('Upload bounded AI provider fault receipt.with.path');
  });

  test('rejects a gate that could publish a passing artifact after a failed test', () => {
    const workflow = structuredClone(loadWorkflow());
    const runStep = workflow.jobs['release-candidate-provider-fault-receipt'].steps.find(
      step => step.name === 'Run isolated AI provider fault integration',
    );
    runStep['continue-on-error'] = false;

    expect(() => validateAiProviderFaultReceiptWorkflow(workflow))
      .toThrow('Run isolated AI provider fault integration must retain its receipt-first failure handling.');
  });
});
