import { describe, expect, test } from '@jest/globals';

import {
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
  POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION,
  POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS,
  buildPolicyRuntimeQuestionAnswerContract,
  getPolicyRuntimeQuestionAnswerActionCode,
  getPolicyRuntimeQuestionAnswerActionIdFromCode,
  getPolicyRuntimeQuestionAnswerSelectedOption,
  parsePolicyRuntimeQuestionAnswer,
  validatePolicyRuntimeQuestionAnswer,
} from '../../services/policyRuntimeQuestionAnswerContract.mjs';
import {
  buildPolicyRuntimeQuestionAnswerReceipt,
  isPolicyRuntimeQuestionAnswerReceiptForClassification,
} from '../../services/policyRuntimeQuestionAnswerReceipt.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';

function normalizedQuestion() {
  return normalizePolicyRuntimeQuestion({
    metadata: { media_type: 'movie' },
    libraries: [
      { id: 7, name: 'Family Movies', media_type: 'movie', is_active: true },
      { id: 8, name: 'Horror Movies', media_type: 'movie', is_active: true },
    ],
    policyResult: {
      ranked: [
        { library_id: 7, score: 86 },
        { library_id: 8, score: 82 },
      ],
    },
  });
}

function classification() {
  return {
    id: 44,
    title: 'Example Movie',
    year: 2026,
    media_type: 'movie',
  };
}

function nativeQuestion() {
  return {
    version: 'policy.runtime_question_persistence.v1',
    runtimeQuestion: {
      contractVersion: 'policy.runtime_question_reduction.v1',
      frameId: 'destination_fit',
    },
    runtimeQuestionReductionPlan: {
      version: 'policy.runtime_question_reduction.v1',
    },
    options: [
      { label: 'Resolve current item', outcomeId: 'resolve_current_item', library_id: 7 },
      { label: 'Do not learn', outcomeId: 'do_not_learn' },
    ],
    meta: {
      runtime_question_persistence: {
        destinationLibraryId: 7,
        destinationLibraryName: 'Family Movies',
      },
    },
  };
}

function answerFor(contract, actionId, destinationLibraryId) {
  return {
    contract_version: contract.version,
    contract_fingerprint: contract.fingerprint,
    action_id: actionId,
    ...(destinationLibraryId ? { destination_library_id: destinationLibraryId } : {}),
  };
}

describe('policyRuntimeQuestionAnswerContract', () => {
  test('projects a normalized question into one bounded server-owned contract', () => {
    const contract = buildPolicyRuntimeQuestionAnswerContract({
      classification: classification(),
      question: normalizedQuestion(),
      currentContextVersion: '2026-08-03T00:00:00.000Z',
    });

    expect(contract).toMatchObject({
      version: POLICY_RUNTIME_QUESTION_ANSWER_CONTRACT_VERSION,
      candidate_item: {
        classification_id: 44,
        title: 'Example Movie',
        media_type: 'movie',
      },
      candidate_destinations: [
        { library_id: 7, library_name: 'Family Movies' },
        { library_id: 8, library_name: 'Horror Movies' },
      ],
      recommendation: {
        status_id: 'leading_candidate_available',
        leading_destination: {
          library_id: 7,
          library_name: 'Family Movies',
          evidence_score: 86,
        },
        why_not_automatic: {
          reason_id: 'missing_identity_evidence',
          message: 'A score alone does not establish destination identity automatically.',
        },
        alternative_candidate_count: 1,
      },
      selected_option_requirements: {
        values_are_server_ids: true,
        free_form_labels_accepted: false,
      },
      learning: {
        eligible: false,
        tier: 'blocked',
        can_authorize_learning: false,
      },
      freshness: {
        status: 'current',
      },
    });
    expect(contract.decision_summary).toMatchObject({
      version: 'policy.runtime_question_decision_presentation.v1',
      deterministic: {
        destination: { library_id: 7, library_name: 'Family Movies' },
      },
    });
    expect(contract.allowed_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
        available: true,
        destination_scope: 'candidate_destinations',
      }),
      expect.objectContaining({
        id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.MARK_EXACT_ITEM_MEMORY,
        available: false,
        unavailable_reason: 'learning_guard_required',
      }),
    ]));
  });

  test.each([
    [normalizedQuestion, 'CEaggJXg5oW6K7qX1AqKKa', 'PEATr2Rkj7InVFBU3aPb9B'],
    [nativeQuestion, 'xcXbkSpSHGzCPRvNMwS7TA', 'UJSvS-zHwWicl5Lya_F7O3'],
  ])('preserves pre-change v1 fingerprint bytes for safe numeric and canonical string IDs', (createQuestion, regular, maximum) => {
    const question = createQuestion();
    for (const [id, fingerprint] of [[44, regular], [Number.MAX_SAFE_INTEGER, maximum]]) {
      for (const input of [id, String(id)]) {
        expect(buildPolicyRuntimeQuestionAnswerContract({ classification: { ...classification(), id: input }, question }))
          .toMatchObject({ fingerprint, candidate_item: { classification_id: id } });
      }
    }
  });

  test('uses the exact BIGINT in the contract and distinguishes adjacent rows', () => {
    const question = normalizedQuestion();
    const ids = ['9007199254740992', '9007199254740993', '9223372036854775807'];
    const rows = ids.map(id => ({ ...classification(), id }));
    const contracts = rows.map(row => buildPolicyRuntimeQuestionAnswerContract({ classification: row, question }));
    expect(contracts.map(contract => contract.candidate_item.classification_id)).toEqual(ids);
    expect(new Set(contracts.map(contract => contract.fingerprint)).size).toBe(ids.length);

    const answer = answerFor(contracts[0], POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION, 7);
    expect(validatePolicyRuntimeQuestionAnswer({ classification: rows[0], question, answer }).ok).toBe(true);
    expect(validatePolicyRuntimeQuestionAnswer({ classification: rows[1], question, answer }).reason)
      .toBe(POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.CONTRACT_FINGERPRINT_MISMATCH);
    expect(validatePolicyRuntimeQuestionAnswer({
      classification: rows[0], question, answer: { ...answer, contract_fingerprint: 'u60vmSq9iaiWsmczVXH61i' },
    }).reason).toBe(POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.CONTRACT_FINGERPRINT_MISMATCH);
  });

  test('rejects noncanonical and unsafe History IDs before hashing', () => {
    const question = normalizedQuestion();
    for (const id of [0, true, '044', '44\n', ['44'], Number.MAX_SAFE_INTEGER + 1, '9223372036854775808']) {
      expect(buildPolicyRuntimeQuestionAnswerContract({ classification: { ...classification(), id }, question })).toBeNull();
    }
  });

  test('binds new receipts exactly and permits unbound legacy receipts for safe rows only', () => {
    const historyId = '9007199254740993';
    const receipt = buildPolicyRuntimeQuestionAnswerReceipt(historyId, {});
    expect(receipt.classification_id).toBe(historyId);
    expect(isPolicyRuntimeQuestionAnswerReceiptForClassification(receipt, historyId)).toBe(true);
    expect(isPolicyRuntimeQuestionAnswerReceiptForClassification(receipt, '9007199254740992')).toBe(false);
    expect(isPolicyRuntimeQuestionAnswerReceiptForClassification({}, historyId)).toBe(false);
    expect(isPolicyRuntimeQuestionAnswerReceiptForClassification({}, 44)).toBe(true);
    expect(isPolicyRuntimeQuestionAnswerReceiptForClassification({ classification_id: 44 }, '44')).toBe(true);
    expect(isPolicyRuntimeQuestionAnswerReceiptForClassification({ classification_id: null }, 44)).toBe(false);
    expect(isPolicyRuntimeQuestionAnswerReceiptForClassification({ classification_id: '044' }, 44)).toBe(false);
    expect(isPolicyRuntimeQuestionAnswerReceiptForClassification(null, 44)).toBe(false);
    expect(() => buildPolicyRuntimeQuestionAnswerReceipt(Number(historyId), {})).toThrow(TypeError);
  });

  test('rejects stale, unknown, changed, and legacy-label answers before resolution', () => {
    const question = normalizedQuestion();
    const contract = buildPolicyRuntimeQuestionAnswerContract({
      classification: classification(),
      question,
    });

    expect(validatePolicyRuntimeQuestionAnswer({
      classification: classification(),
      question,
      answer: answerFor(contract, POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION, 99),
    })).toMatchObject({
      ok: false,
      reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.DESTINATION_NOT_CANDIDATE,
    });

    expect(validatePolicyRuntimeQuestionAnswer({
      classification: classification(),
      question,
      answer: {
        ...answerFor(contract, POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION, 7),
        contract_fingerprint: 'old-contract-fingerprint',
      },
    })).toMatchObject({
      ok: false,
      reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.CONTRACT_FINGERPRINT_MISMATCH,
    });

    expect(validatePolicyRuntimeQuestionAnswer({
      classification: classification(),
      question,
      isStale: true,
      answer: answerFor(contract, POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION, 7),
    })).toMatchObject({
      ok: false,
      reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.STALE_QUESTION,
    });

    expect(parsePolicyRuntimeQuestionAnswer({
      ...answerFor(contract, POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION, 7),
      selected_option: 'Family Movies',
    })).toMatchObject({
      ok: false,
      reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.INVALID_ANSWER,
    });
  });

  test('requires retry when a historic high-score record lacks route-safety details', () => {
    const question = normalizedQuestion();
    const historicClassification = {
      ...classification(),
      method: 'signal_calculation',
      confidence: 90,
      metadata: {
        policyResult: {
          action: 'auto_classify',
          ranked: [{
            library_id: 7,
            score: 90,
            prompt_threshold: 60,
            auto_classify_threshold: 85,
          }],
        },
      },
    };
    const contract = buildPolicyRuntimeQuestionAnswerContract({
      classification: historicClassification,
      question,
    });
    const confirmAction = contract.allowed_actions.find(action => (
      action.id === POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION
    ));
    const retryAction = contract.allowed_actions.find(action => (
      action.id === POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.RETRY_CLASSIFICATION
    ));

    expect(contract.freshness).toMatchObject({
      status: 'stale',
      reason: 'route_safety_details_unavailable',
    });
    expect(confirmAction).toMatchObject({
      available: false,
      unavailable_reason: 'route_safety_details_unavailable',
    });
    expect(retryAction).toMatchObject({ available: true });
    expect(validatePolicyRuntimeQuestionAnswer({
      classification: historicClassification,
      question,
      answer: answerFor(contract, POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION, 7),
    })).toMatchObject({
      ok: false,
      reason: POLICY_RUNTIME_QUESTION_ANSWER_REASON_IDS.STALE_QUESTION,
    });
  });

  test('allows an active-media destination change without treating its label as an instruction', () => {
    const question = normalizedQuestion();
    const contract = buildPolicyRuntimeQuestionAnswerContract({
      classification: classification(),
      question,
    });
    const result = validatePolicyRuntimeQuestionAnswer({
      classification: classification(),
      question,
      answer: answerFor(contract, POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CHANGE_DESTINATION, 42),
    });

    expect(result).toMatchObject({
      ok: true,
      answer: {
        actionId: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CHANGE_DESTINATION,
        destinationLibraryId: 42,
      },
    });
  });

  test('maps a native outcome to a server-derived selected option only after validation', () => {
    const question = nativeQuestion();
    const contract = buildPolicyRuntimeQuestionAnswerContract({
      classification: classification(),
      question,
    });
    const answer = answerFor(contract, POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION, 7);

    expect(validatePolicyRuntimeQuestionAnswer({ classification: classification(), question, answer }))
      .toMatchObject({ ok: true });
    expect(getPolicyRuntimeQuestionAnswerSelectedOption({
      question,
      answer: {
        contractVersion: answer.contract_version,
        contractFingerprint: answer.contract_fingerprint,
        actionId: answer.action_id,
        destinationLibraryId: answer.destination_library_id,
      },
    })).toBe('Resolve current item');
    expect(contract.recommendation).toBeNull();
  });

  test('uses compact reversible Discord action codes', () => {
    const code = getPolicyRuntimeQuestionAnswerActionCode(
      POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
    );

    expect(code).toBe('c');
    expect(getPolicyRuntimeQuestionAnswerActionIdFromCode(code))
      .toBe(POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION);
    expect(getPolicyRuntimeQuestionAnswerActionIdFromCode('unknown')).toBeNull();
  });
});
