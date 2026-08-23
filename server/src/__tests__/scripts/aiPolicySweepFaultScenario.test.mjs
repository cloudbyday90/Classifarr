/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { readFile } from 'node:fs/promises';
import {
  AI_POLICY_SWEEP_FAULT_SCENARIO_VERSION,
  runAiPolicySweepFaultScenarioDocument,
  validateAiPolicySweepFaultScenarioDocument,
} from '../../../../scripts/lib/aiPolicySweepFaultScenario.mjs';

const defaultScenarioDocumentUrl = new URL(
  '../../../../scripts/fixtures/ai-policy-sweep.fault-scenarios.json',
  import.meta.url,
);

async function readDefaultScenarioDocument() {
  return JSON.parse(await readFile(defaultScenarioDocumentUrl, 'utf8'));
}

describe('AI policy sweep fault scenarios', () => {
  test('validates and detects every checked-in synthetic fault contract', async () => {
    const document = await readDefaultScenarioDocument();
    const outcome = runAiPolicySweepFaultScenarioDocument(document);

    expect(outcome.validation).toEqual({ ok: true, scenarioCount: 4, issues: [] });
    expect(outcome.summary).toEqual({
      passedScenarioCount: 4,
      failedScenarioCount: 0,
      detectedFaultSignalCount: 3,
    });
    expect(outcome.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'fault-controlled-retry',
        passed: true,
        actual: {
          evaluationPassed: true,
          failureCheckIds: [],
          signalIds: [],
        },
      }),
      expect.objectContaining({
        id: 'fault-fallback',
        passed: true,
        actual: expect.objectContaining({
          evaluationPassed: false,
          failureCheckIds: ['classification_method', 'fallback_not_allowed'],
          signalIds: ['fallback_method'],
        }),
      }),
      expect.objectContaining({
        id: 'fault-existing-media-contamination',
        passed: true,
        actual: expect.objectContaining({
          evaluationPassed: false,
          signalIds: ['existing_media_method'],
        }),
      }),
      expect.objectContaining({
        id: 'fault-source-library-contamination',
        passed: true,
        actual: expect.objectContaining({
          evaluationPassed: false,
          signalIds: ['source_library_method'],
        }),
      }),
    ]));
    expect(JSON.stringify(outcome)).not.toContain('Synthetic fallback safety failure');
  });

  test('fails closed on unexpected fields, mismatched IDs, and unsupported expected signals', async () => {
    const document = await readDefaultScenarioDocument();
    document.untrustedNote = 'do not allow free-form scenario metadata';
    document.scenarios[0].fixture.id = 'different-fixture-id';
    document.scenarios[1].expected.signalIds = ['unknown_signal'];
    document.scenarios[1].expected.failureCheckIds = [];

    const validation = validateAiPolicySweepFaultScenarioDocument(document);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'unknown_fault_scenario_field', path: 'document.untrustedNote' }),
      expect.objectContaining({ id: 'fault_scenario_fixture_id_mismatch' }),
      expect.objectContaining({ id: 'invalid_fault_scenario_signal_id' }),
      expect.objectContaining({ id: 'missing_fault_scenario_failure_check_id' }),
    ]));
  });

  test('does not report a passing contract when the expected fault detection drifts', async () => {
    const document = await readDefaultScenarioDocument();
    document.scenarios[1].expected.failureCheckIds = ['fallback_not_allowed'];

    const outcome = runAiPolicySweepFaultScenarioDocument(document);

    expect(outcome.validation.ok).toBe(true);
    expect(outcome.summary).toEqual({
      passedScenarioCount: 3,
      failedScenarioCount: 1,
      detectedFaultSignalCount: 3,
    });
    expect(outcome.results.find(result => result.id === 'fault-fallback')).toEqual(
      expect.objectContaining({
        passed: false,
        checks: expect.arrayContaining([
          expect.objectContaining({ id: 'failure_check_ids', passed: false }),
        ]),
      }),
    );
  });

  test('rejects an unsupported fault-scenario document version before execution', async () => {
    const document = await readDefaultScenarioDocument();
    document.version = `${AI_POLICY_SWEEP_FAULT_SCENARIO_VERSION}.unsupported`;

    expect(runAiPolicySweepFaultScenarioDocument(document)).toEqual(
      expect.objectContaining({
        validation: expect.objectContaining({
          ok: false,
          issues: expect.arrayContaining([
            expect.objectContaining({ id: 'invalid_fault_scenario_document_version' }),
          ]),
        }),
        results: [],
      }),
    );
  });
});
