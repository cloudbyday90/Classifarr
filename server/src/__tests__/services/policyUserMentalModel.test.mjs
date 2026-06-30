import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  MENTAL_MODEL_QUESTION_IDS,
  POLICY_SETUP_COPY_RISK_IDS,
  POLICY_SETUP_STEP_AUDIT_RISK_IDS,
  POLICY_SETUP_STEP_IDS,
  POLICY_UX_SELECTION_PATTERN_IDS,
  POLICY_UX_TERM_AUDIT_RISK_IDS,
  POLICY_UX_TERM_IDS,
  buildPolicySetupCopyAudit,
  buildPolicySetupStepAudit,
  buildPolicyUserMentalModelAudit,
  getDurableAuthorityTermIds,
  getPolicySetupQuestion,
  getPolicySetupStep,
  getPolicyUserMentalModel,
  getPolicyUxTerm,
  includesInternalPolicyLanguage,
  listDefaultPolicySetupCopy,
  listInternalPolicyLanguageFlags,
  listPolicySetupQuestions,
  listPolicySetupSteps,
  listPolicyUxTerms,
  validatePolicySetupStepContract,
  validatePolicyUxTermContract,
  validatePolicySetupCopy,
} from '../../services/policyUserMentalModel.mjs';

describe('policyUserMentalModel', () => {
  test('defines the four default setup questions in operator language', () => {
    expect(listPolicySetupQuestions().map(question => question.question)).toEqual([
      'What already belongs here?',
      'What should always or never belong here?',
      'When should Classifarr ask?',
      'Can this destination route?',
    ]);

    expect(listPolicySetupQuestions().map(question => question.id)).toEqual([
      MENTAL_MODEL_QUESTION_IDS.OBSERVED_BELONGS_HERE,
      MENTAL_MODEL_QUESTION_IDS.DECLARED_LIMITS,
      MENTAL_MODEL_QUESTION_IDS.REVIEW_BEHAVIOR,
      MENTAL_MODEL_QUESTION_IDS.ROUTING_TARGET,
    ]);
  });

  test('defines the approved policy UX labels', () => {
    expect(listPolicyUxTerms().map(term => term.label)).toEqual([
      'Belongs Here',
      'Helpful Matches',
      'Hard Limits',
      'Avoid',
      'Ask When Unsure',
      'Routing Target',
      'Readiness',
    ]);
  });

  test('ties observed library suggestions to operator-declared intent for Belongs Here', () => {
    const belongsHere = getPolicyUxTerm(POLICY_UX_TERM_IDS.BELONGS_HERE);

    expect(belongsHere.authoritySourceIds).toEqual([
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(belongsHere.selectionPatternId)
      .toBe(POLICY_UX_SELECTION_PATTERN_IDS.OBSERVED_SUGGESTION_MULTI_SELECT);
    expect(belongsHere.mustMentionObservedEvidence).toBe(true);
    expect(belongsHere.mustMentionDeclaredIntent).toBe(true);
    expect(belongsHere.broadGenreRule)
      .toBe('Broad genres can suggest fit, but they do not define a destination unless the operator accepts them as intent.');
  });

  test('keeps hard limits tied to declared intent only', () => {
    const hardLimits = getPolicyUxTerm(POLICY_UX_TERM_IDS.HARD_LIMITS);

    expect(hardLimits.authoritySourceIds).toEqual([
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ]);
    expect(hardLimits.selectionPatternId)
      .toBe(POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_CONSTRAINT_MULTI_SELECT);
    expect(hardLimits.helper).toContain('explicit operator intent');
    expect(hardLimits.broadGenreRule).toBe('Do not infer hard limits from missing examples.');
  });

  test('frames runtime review around destination fit instead of genre priority', () => {
    const askWhenUnsure = getPolicyUxTerm(POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE);

    expect(askWhenUnsure.plainQuestion).toBe('When should Classifarr ask for review?');
    expect(askWhenUnsure.broadGenreRule).toBe('Ask about destination fit, not which broad genre is more important.');
    expect(includesInternalPolicyLanguage(askWhenUnsure.helper)).toBe(false);
  });

  test('exposes setup questions by id', () => {
    expect(getPolicySetupQuestion(MENTAL_MODEL_QUESTION_IDS.OBSERVED_BELONGS_HERE).question)
      .toBe('What already belongs here?');
    expect(getPolicySetupQuestion('unknown')).toBeNull();
  });

  test('flags internal policy language that should not appear in normal setup copy', () => {
    expect(includesInternalPolicyLanguage('Adjust scoring weights before replay parity.')).toBe(true);
    expect(includesInternalPolicyLanguage('Provider gate blocked by TMDB coverage.')).toBe(true);
    expect(includesInternalPolicyLanguage('Identity signal impact preview is different.')).toBe(true);
    expect(includesInternalPolicyLanguage('Use observed examples as suggestions.')).toBe(false);
    expect(listInternalPolicyLanguageFlags()).toContain('internal diagnostic');
  });

  test('validates approved setup copy against Phase 0R authority context', () => {
    expect(validatePolicySetupCopy({
      termId: POLICY_UX_TERM_IDS.BELONGS_HERE,
      label: 'Belongs Here',
      helperText: 'Use observed examples as suggestions, then accept only the values that should define this destination.',
    })).toMatchObject({
      ok: true,
      expectedLabel: 'Belongs Here',
      issues: [],
    });
  });

  test('detects unknown or mismatched setup labels', () => {
    expect(validatePolicySetupCopy({
      termId: 'legacy_preset',
      label: 'Preset',
      helperText: 'Use this preset.',
    }).issues.map(issue => issue.riskId)).toContain(POLICY_SETUP_COPY_RISK_IDS.UNKNOWN_UX_TERM);

    expect(validatePolicySetupCopy({
      termId: POLICY_UX_TERM_IDS.HARD_LIMITS,
      label: 'Strict Rules',
      helperText: 'Use explicit operator intent to block this destination.',
    }).issues.map(issue => issue.riskId)).toContain(POLICY_SETUP_COPY_RISK_IDS.MISMATCHED_VISIBLE_LABEL);
  });

  test('requires observed and declared context where the term authority needs it', () => {
    const belongsHereIssues = validatePolicySetupCopy({
      termId: POLICY_UX_TERM_IDS.BELONGS_HERE,
      label: 'Belongs Here',
      helperText: 'Add values for this destination.',
    }).issues.map(issue => issue.riskId);

    expect(belongsHereIssues).toEqual([
      POLICY_SETUP_COPY_RISK_IDS.MISSING_OBSERVED_EVIDENCE_CONTEXT,
      POLICY_SETUP_COPY_RISK_IDS.MISSING_DECLARED_INTENT_CONTEXT,
    ]);
  });

  test('rejects internal diagnostics and broad-genre authority in setup copy', () => {
    const riskIds = validatePolicySetupCopy({
      termId: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
      label: 'Ask When Unsure',
      helperText: 'Use operator-declared review triggers when genre priority or provider gate output says the genre should win.',
    }).issues.map(issue => issue.riskId);

    expect(riskIds).toContain(POLICY_SETUP_COPY_RISK_IDS.INTERNAL_POLICY_LANGUAGE);
    expect(riskIds).toContain(POLICY_SETUP_COPY_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE);
  });

  test('builds a setup-copy audit summary', () => {
    const audit = buildPolicySetupCopyAudit([
      {
        termId: POLICY_UX_TERM_IDS.ROUTING_TARGET,
        label: 'Routing Target',
        helperText: 'Operator-declared routing readiness is separate from classification confidence.',
      },
      {
        termId: POLICY_UX_TERM_IDS.HARD_LIMITS,
        label: '',
        helperText: '',
      },
    ]);

    expect(audit.ok).toBe(false);
    expect(audit.checkedCount).toBe(2);
    expect(audit.issueCount).toBeGreaterThan(0);
    expect(audit.results[0].ok).toBe(true);
  });

  test('exposes valid default setup copy for approved policy UX terms', () => {
    const setupCopy = listDefaultPolicySetupCopy();

    expect(setupCopy).toHaveLength(listPolicyUxTerms().length);
    expect(setupCopy.map(copy => copy.termId)).toEqual(listPolicyUxTerms().map(term => term.id));
    expect(buildPolicySetupCopyAudit(setupCopy)).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: setupCopy.length,
      issueCount: 0,
    }));
  });

  test('defines a four-step setup flow around the simple mental model', () => {
    expect(listPolicySetupSteps().map(step => step.id)).toEqual([
      POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION,
      POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
      POLICY_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
      POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    ]);

    expect(listPolicySetupSteps().map(step => step.questionId)).toEqual([
      MENTAL_MODEL_QUESTION_IDS.OBSERVED_BELONGS_HERE,
      MENTAL_MODEL_QUESTION_IDS.DECLARED_LIMITS,
      MENTAL_MODEL_QUESTION_IDS.REVIEW_BEHAVIOR,
      MENTAL_MODEL_QUESTION_IDS.ROUTING_TARGET,
    ]);

    expect(getPolicySetupStep(POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION))
      .toEqual(expect.objectContaining({
        termIds: [POLICY_UX_TERM_IDS.BELONGS_HERE],
        allowedSelectionPatternIds: [
          POLICY_UX_SELECTION_PATTERN_IDS.OBSERVED_SUGGESTION_MULTI_SELECT,
        ],
      }));
  });

  test('audits the default setup flow as approved product language', () => {
    expect(buildPolicySetupStepAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: listPolicySetupSteps().length,
      issueCount: 0,
    }));
  });

  test('fails setup-step audits for unknown terms, unsupported patterns, and diagnostic language', () => {
    const invalidStep = {
      ...getPolicySetupStep(POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION),
      title: 'Tune provider gate',
      termIds: [
        POLICY_UX_TERM_IDS.BELONGS_HERE,
        'legacy_preset',
      ],
      authoritySourceIds: [
        AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      ],
      allowedSelectionPatternIds: [
        POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_SIGNAL_MULTI_SELECT,
      ],
      operatorAction: 'Use genre priority from the internal diagnostic panel.',
    };

    expect(validatePolicySetupStepContract(invalidStep).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        POLICY_SETUP_STEP_AUDIT_RISK_IDS.UNKNOWN_TERM,
        POLICY_SETUP_STEP_AUDIT_RISK_IDS.TERM_PATTERN_NOT_ALLOWED,
        POLICY_SETUP_STEP_AUDIT_RISK_IDS.MISSING_OBSERVED_EVIDENCE_SOURCE,
        POLICY_SETUP_STEP_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
        POLICY_SETUP_STEP_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      ]));
  });

  test('audits the complete Phase 0R.2 mental model contract', () => {
    expect(buildPolicyUserMentalModelAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedTermCount: listPolicyUxTerms().length,
      checkedSetupCopyCount: listDefaultPolicySetupCopy().length,
      checkedSetupStepCount: listPolicySetupSteps().length,
      issueCount: 0,
      setupStepAudit: expect.objectContaining({
        ok: true,
      }),
      setupCopyAudit: expect.objectContaining({
        ok: true,
      }),
    }));
  });

  test('fails term audits when interaction pattern or authority source drifts', () => {
    const invalidTerm = {
      ...getPolicyUxTerm(POLICY_UX_TERM_IDS.HARD_LIMITS),
      selectionPatternId: 'raw_select',
      authoritySourceIds: [
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
        AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      ],
    };

    expect(validatePolicyUxTermContract(invalidTerm).issues.map(issue => issue.riskId)).toEqual([
      POLICY_UX_TERM_AUDIT_RISK_IDS.UNKNOWN_SELECTION_PATTERN,
      POLICY_UX_TERM_AUDIT_RISK_IDS.HARD_LIMITS_ALLOW_OBSERVED_EVIDENCE,
    ]);
  });

  test('rejects broad genre authority wording in the term contract itself', () => {
    const invalidTerm = {
      ...getPolicyUxTerm(POLICY_UX_TERM_IDS.BELONGS_HERE),
      broadGenreRule: 'Genre decides which destination should win.',
    };

    expect(validatePolicyUxTermContract(invalidTerm).issues.map(issue => issue.riskId))
      .toContain(POLICY_UX_TERM_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE);
  });

  test('exposes durable-authority terms without making every term durable by itself', () => {
    const durableTerms = getDurableAuthorityTermIds();

    expect(durableTerms).toEqual([
      POLICY_UX_TERM_IDS.BELONGS_HERE,
      POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
      POLICY_UX_TERM_IDS.HARD_LIMITS,
      POLICY_UX_TERM_IDS.AVOID,
      POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
      POLICY_UX_TERM_IDS.ROUTING_TARGET,
      POLICY_UX_TERM_IDS.READINESS,
    ]);
    expect(getPolicyUxTerm(POLICY_UX_TERM_IDS.READINESS).authoritySourceIds)
      .toContain(AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS);
  });

  test('exposes immutable mental-model records', () => {
    const model = getPolicyUserMentalModel();
    const terms = listPolicyUxTerms();
    const setupCopy = listDefaultPolicySetupCopy();

    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.setupQuestions)).toBe(true);
    expect(Object.isFrozen(model.setupQuestions[0])).toBe(true);
    expect(Object.isFrozen(terms)).toBe(true);
    expect(Object.isFrozen(terms[0])).toBe(true);
    expect(Object.isFrozen(setupCopy)).toBe(true);
    expect(Object.isFrozen(setupCopy[0])).toBe(true);
    expect(Object.isFrozen(listPolicySetupSteps())).toBe(true);
    expect(Object.isFrozen(listPolicySetupSteps()[0])).toBe(true);
  });

  test('returns null for unknown UX terms', () => {
    expect(getPolicyUxTerm('unknown')).toBeNull();
    expect(getPolicySetupStep('unknown')).toBeNull();
  });
});
