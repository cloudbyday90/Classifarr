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
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS,
} from '../../services/policyNativeIntentRuntimeEvaluator.mjs';
import {
  buildPolicyNativeClassificationQuestionHandoff,
} from '../../services/policyNativeClassificationQuestionHandoff.mjs';
import {
  POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS,
  POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS,
  buildPolicyRuntimeQuestionPersistenceAdmission,
  buildPolicyRuntimeQuestionPersistenceAdmissionAudit,
  isPolicyRuntimeQuestionPersistenceEnvelope,
} from '../../services/policyRuntimeQuestionPersistenceAdmission.mjs';

function currentProfileHandoff(overrides = {}) {
  return {
    ok: true,
    profileEvidence: {
      libraryProfile: {
        identityCandidates: [],
        compatibilityCandidates: [{
          key: 'genre:animation',
          label: 'Animation',
          count: 12,
          confidence: 0.9,
        }],
        outliers: [],
      },
    },
    profileFreshness: {
      key: 'library_profile',
      label: 'Library profile',
      value: 'current',
      stale: false,
      updatedAt: '2026-07-25T12:00:00.000Z',
    },
    ...overrides,
  };
}

function nativeRuntime(overrides = {}) {
  const { contract: contractOverrides = {}, ...runtimeOverrides } = overrides;

  return {
    statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_FAILED,
    avoidPenalty: 0,
    contract: {
      source: 'native_intent',
      validation: { valid: true },
      purpose: [{ signal_type: 'genres', values: { require_any: ['Animation'] } }],
      helpful_hints: [],
      hard_limits: [{ signal_type: 'certifications', values: { max: 'PG-13' } }],
      avoid: [],
      ...contractOverrides,
    },
    ...runtimeOverrides,
  };
}

function classificationResult(overrides = {}) {
  const runtime = overrides.runtime || nativeRuntime();

  return {
    library: {
      id: 6,
      name: 'Animated Movies',
    },
    confidence: 96,
    method: 'policy_auto',
    policyResult: {
      ranked: [{
        library_id: 6,
        library_name: 'Animated Movies',
        native_intent_runtime: runtime,
      }],
    },
    ...overrides,
  };
}

async function buildReviewHandoff(source = classificationResult()) {
  return buildPolicyNativeClassificationQuestionHandoff({
    classificationResult: source,
    loadProfileEvidence: async ({ libraryId }) => currentProfileHandoff({ libraryId }),
    resolveStoredRoutingConfig: async library => ({
      ...library,
      arr_type: 'radarr',
      arr_id: 3,
      root_folder: '/media/animated',
    }),
  });
}

describe('policyRuntimeQuestionPersistenceAdmission', () => {
  test('admits a canonical native review plan into the existing pending-question shape', async () => {
    const sourceResult = classificationResult({
      title: 'Untrusted request title',
      providerPayload: { raw: 'must not persist' },
    });
    const handoff = await buildReviewHandoff(sourceResult);

    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: sourceResult,
      handoff,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.ADMITTED,
      classificationPatch: expect.objectContaining({
        needs_clarification: true,
        pending_reason: expect.any(String),
      }),
      sideEffects: expect.objectContaining({
        classificationPersisted: false,
        questionPersisted: false,
        routingExecuted: false,
        learningWritten: false,
      }),
      audit: { ok: true, issueCount: 0, issues: [] },
    }));
    expect(isPolicyRuntimeQuestionPersistenceEnvelope(result.persistedQuestion)).toBe(true);
    expect(result.classificationPatch.policy_question).toBe(result.persistedQuestion);
    expect(result.persistedQuestion.options).toEqual([
      expect.objectContaining({
        outcomeId: 'resolve_current_item',
        library_id: 6,
        library_name: 'Animated Movies',
        learningEligible: false,
      }),
      expect.objectContaining({
        outcomeId: 'do_not_learn',
        learningEligible: false,
      }),
    ]);
    expect(result.persistedQuestion.options[1]).not.toHaveProperty('library_id');
    expect(result.persistedQuestion.meta.runtime_question_persistence).toEqual(
      expect.objectContaining({
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
        evidenceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('Untrusted request title');
    expect(JSON.stringify(result)).not.toContain('must not persist');
    expect(JSON.stringify(result)).not.toContain('/media/animated');
  });

  test('preserves a pre-existing legacy question rather than replacing it', async () => {
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: classificationResult({
        policy_question: {
          question: 'Legacy question',
          options: [{ label: 'Existing destination', library_id: 6 }],
        },
      }),
      handoff: await buildReviewHandoff(),
    });

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS
        .PRESERVED_EXISTING_QUESTION,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.EXISTING_QUESTION_PRESERVED,
      classificationPatch: null,
      audit: { ok: true },
    });
  });

  test.each([
    [{ id: 6 }, 6],
    [{ id: '6' }, 6],
    [{ library_id: '6' }, 6],
    [{ id: null, library_id: 6 }, 6],
    [{ id: 6, library_id: 7 }, 6],
    [{ id: '2147483647' }, 2147483647],
  ])('writes matching exact destination copies from %p', async (library, expectedId) => {
    const source = classificationResult({ library: { ...library, name: 'Animated Movies' } });
    source.policyResult.ranked[0].library_id = expectedId;
    const handoff = await buildReviewHandoff(source);
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({ classificationResult: source, handoff });
    expect(result).toMatchObject({ ok: true, audit: { ok: true }, persistedQuestion: {
      meta: { runtime_question_persistence: { destinationLibraryId: expectedId } },
      options: expect.arrayContaining([expect.objectContaining({ outcomeId: 'resolve_current_item', library_id: expectedId })]),
    } });
  });

  test.each([
    { id: ' 6 ', library_id: 6 }, { id: '06' }, { id: '6e0' }, { id: [6] }, { id: true },
    { id: { toString: null } }, { id: 6.5 }, { id: 0 }, { id: '2147483648' },
  ])('refuses %p without emitting a question or an admission patch', async (library) => {
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: classificationResult({ library }), handoff: await buildReviewHandoff(),
    });
    expect(result).toMatchObject({
      ok: false, statusId: 'rejected', reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.NO_SELECTED_LIBRARY,
      persistedQuestion: null, classificationPatch: null, audit: { ok: true },
    });
  });

  test.each([undefined, '06', 7])('audits the matching saved destination even when metadata is changed to %p', async (id) => {
    const source = classificationResult();
    const admission = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: source, handoff: await buildReviewHandoff(source),
    });
    admission.persistedQuestion.meta.runtime_question_persistence.destinationLibraryId = id;
    expect(buildPolicyRuntimeQuestionPersistenceAdmissionAudit(admission)).toMatchObject({
      ok: false, issues: ['invalid_persisted_question_destination'],
    });
  });

  test.each(['changed-selection', 'different-result', 'copied-handoff', 'replaced-plan', 'changed-summary'])(
    'rejects a structurally valid but unbound %s before creating an envelope', async kind => {
      const source = classificationResult();
      let handoff = await buildReviewHandoff(source);
      let owner = source;
      if (kind === 'changed-selection') source.library = { id: 7, name: 'Other library' };
      if (kind === 'different-result') owner = { ...source };
      if (kind === 'copied-handoff') handoff = structuredClone(handoff);
      if (kind === 'replaced-plan') handoff.plan = structuredClone(handoff.plan);
      if (kind === 'changed-summary') handoff.summary.profileAvailable = false;

      expect(buildPolicyRuntimeQuestionPersistenceAdmission({ classificationResult: owner, handoff })).toMatchObject({
        ok: false, statusId: 'rejected', reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.HANDOFF_LIBRARY_BINDING_INVALID,
        persistedQuestion: null, classificationPatch: null, audit: { ok: true },
      });
    },
  );

  test('admits the same live result when its library ID changes to an equivalent canonical string', async () => {
    const source = classificationResult();
    const handoff = await buildReviewHandoff(source);
    source.library = { library_id: '6', library_name: 'Animated Movies' };
    expect(buildPolicyRuntimeQuestionPersistenceAdmission({ classificationResult: source, handoff })).toMatchObject({
      ok: true, persistedQuestion: { meta: { runtime_question_persistence: { destinationLibraryId: 6 } } },
    });
  });

  test('rejects a handoff that reports a prohibited side effect', async () => {
    const handoff = await buildReviewHandoff();
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: classificationResult(),
      handoff: {
        ...handoff,
        sideEffects: {
          ...handoff.sideEffects,
          questionCreated: true,
        },
      },
    });

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS
        .HANDOFF_SIDE_EFFECT_REPORTED,
      classificationPatch: null,
      audit: { ok: true },
    });
  });

  test('re-audits a handoff instead of trusting a stale audit result', async () => {
    const handoff = await buildReviewHandoff();
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: classificationResult(),
      handoff: {
        ...handoff,
        summary: {
          ...handoff.summary,
          title: 'Untrusted substituted title',
        },
      },
    });

    expect(handoff.audit.ok).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.REJECTED,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.HANDOFF_AUDIT_FAILED,
      classificationPatch: null,
      audit: { ok: true },
    });
  });

  test('does not materialize a question when native automation is already safe to route', async () => {
    const source = classificationResult({ runtime: nativeRuntime({ statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.ACTIVE }) });
    const handoff = await buildReviewHandoff(source);
    const result = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: source,
      handoff,
    });

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_RUNTIME_QUESTION_PERSISTENCE_ADMISSION_STATUS_IDS.NOT_APPLICABLE,
      reasonId: POLICY_RUNTIME_QUESTION_PERSISTENCE_REASON_IDS.NO_QUESTION_REQUESTED,
      audit: { ok: true },
    });
  });

  test('audit rejects an admitted result that reports a persistence side effect', async () => {
    const source = classificationResult();
    const admission = buildPolicyRuntimeQuestionPersistenceAdmission({
      classificationResult: source,
      handoff: await buildReviewHandoff(source),
    });
    const audit = buildPolicyRuntimeQuestionPersistenceAdmissionAudit({
      ...admission,
      sideEffects: {
        ...admission.sideEffects,
        questionPersisted: true,
      },
    });

    expect(audit).toEqual(expect.objectContaining({
      ok: false,
      issues: expect.arrayContaining(['side_effect_reported']),
    }));
  });
});
