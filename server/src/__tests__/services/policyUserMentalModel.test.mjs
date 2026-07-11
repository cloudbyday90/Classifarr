import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  MENTAL_MODEL_QUESTION_IDS,
  POLICY_SETUP_ACTION_KIND_IDS,
  POLICY_SETUP_ANSWER_KIND_IDS,
  POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS,
  POLICY_SETUP_COPY_RISK_IDS,
  POLICY_SETUP_CARD_AUDIT_RISK_IDS,
  POLICY_SETUP_FIELD_CONTROL_KIND_IDS,
  POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS,
  POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS,
  POLICY_SETUP_SURFACE_AUDIT_RISK_IDS,
  POLICY_SETUP_SURFACE_ROLE_IDS,
  POLICY_SETUP_STEP_AUDIT_RISK_IDS,
  POLICY_SETUP_STEP_IDS,
  POLICY_UX_SELECTION_PATTERN_IDS,
  POLICY_UX_TERM_AUDIT_RISK_IDS,
  POLICY_UX_TERM_IDS,
  buildPolicySetupAnswerShapeAudit,
  buildPolicySetupCopyAudit,
  buildPolicySetupCardAudit,
  buildPolicySetupFieldGroupAudit,
  buildPolicySetupJourneyAudit,
  buildPolicySetupStepAudit,
  buildPolicySetupSurfaceAudit,
  buildPolicyUserMentalModelAudit,
  getDurableAuthorityTermIds,
  getPolicySetupAnswerShape,
  getPolicySetupCard,
  getPolicySetupFieldGroup,
  getPolicySetupJourneyStage,
  getPolicySetupQuestion,
  getPolicySetupStep,
  getPolicySetupSurfaceContract,
  getPolicyUserMentalModel,
  getPolicyUxTerm,
  includesInternalPolicyLanguage,
  listDefaultPolicySetupAnswerShapes,
  listDefaultPolicySetupCopy,
  listDefaultPolicySetupCards,
  listDefaultPolicySetupFieldGroups,
  listDefaultPolicySetupJourneyStages,
  listInternalPolicyLanguageFlags,
  listPolicySetupQuestions,
  listPolicySetupSurfaceContracts,
  listPolicySetupSteps,
  listPolicyUxTerms,
  validatePolicySetupAnswerShapeContract,
  validatePolicySetupCardContract,
  validatePolicySetupFieldGroupContract,
  validatePolicySetupJourneyStageContract,
  validatePolicySetupStepContract,
  validatePolicySetupSurfaceContract,
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

  test('validates approved setup copy against policy-authoring authority context', () => {
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

  test('defines setup cards that translate the mental model into simple operator actions', () => {
    const cards = listDefaultPolicySetupCards();

    expect(cards.map(card => card.stepId)).toEqual(listPolicySetupSteps().map(step => step.id));
    expect(cards.map(card => card.heading)).toEqual([
      'What already belongs here?',
      'What should always or never belong here?',
      'When should Classifarr ask?',
      'Can this destination route?',
    ]);

    expect(getPolicySetupCard(POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION))
      .toEqual(expect.objectContaining({
        primaryActionLabel: 'Review suggestions',
        termIds: [POLICY_UX_TERM_IDS.BELONGS_HERE],
      }));
    expect(buildPolicySetupCardAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: cards.length,
      issueCount: 0,
    }));
  });

  test('defines setup surfaces that separate suggestions, edits, and readiness status', () => {
    const surfaces = listPolicySetupSurfaceContracts();

    expect(surfaces.map(surface => surface.stepId)).toEqual(listPolicySetupSteps().map(step => step.id));
    expect(surfaces.map(surface => surface.roleId)).toEqual([
      POLICY_SETUP_SURFACE_ROLE_IDS.OBSERVED_SUGGESTION_REVIEW,
      POLICY_SETUP_SURFACE_ROLE_IDS.DECLARED_INTENT_EDIT,
      POLICY_SETUP_SURFACE_ROLE_IDS.REVIEW_BEHAVIOR_EDIT,
      POLICY_SETUP_SURFACE_ROLE_IDS.READINESS_STATUS,
    ]);
    expect(surfaces.map(surface => surface.actionKindId)).toEqual([
      POLICY_SETUP_ACTION_KIND_IDS.REVIEW_SUGGESTIONS,
      POLICY_SETUP_ACTION_KIND_IDS.EDIT_DESTINATION_RULES,
      POLICY_SETUP_ACTION_KIND_IDS.CONFIGURE_REVIEW_TRIGGERS,
      POLICY_SETUP_ACTION_KIND_IDS.CHECK_ROUTING_READINESS,
    ]);

    expect(getPolicySetupSurfaceContract(POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS))
      .toEqual(expect.objectContaining({
        canEditDeclaredIntent: false,
        canPersistPolicyIntent: false,
        roleId: POLICY_SETUP_SURFACE_ROLE_IDS.READINESS_STATUS,
      }));
    expect(buildPolicySetupSurfaceAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: surfaces.length,
      issueCount: 0,
    }));
  });

  test('defines a first-run setup journey with one primary action per stage', () => {
    const stages = listDefaultPolicySetupJourneyStages();

    expect(stages.map(stage => stage.stepId)).toEqual(listPolicySetupSteps().map(step => step.id));
    expect(stages.map(stage => stage.order)).toEqual([1, 2, 3, 4]);
    expect(stages.map(stage => stage.primaryActionLabels)).toEqual([
      ['Review suggestions'],
      ['Set destination rules'],
      ['Set review triggers'],
      ['Check routing readiness'],
    ]);

    expect(getPolicySetupJourneyStage(POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION))
      .toEqual(expect.objectContaining({
        operatorGoal: 'Understand what the current library already appears to contain.',
        canPersistPolicyIntent: false,
      }));
    expect(buildPolicySetupJourneyAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: stages.length,
      issueCount: 0,
    }));
  });

  test('defines field groups that keep controls simple and bounded', () => {
    const groups = listDefaultPolicySetupFieldGroups();

    expect(groups.map(group => group.groupId)).toEqual([
      POLICY_UX_TERM_IDS.BELONGS_HERE,
      POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
      POLICY_UX_TERM_IDS.HARD_LIMITS,
      POLICY_UX_TERM_IDS.AVOID,
      POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
      POLICY_UX_TERM_IDS.ROUTING_TARGET,
      POLICY_UX_TERM_IDS.READINESS,
    ]);

    expect(getPolicySetupFieldGroup(POLICY_UX_TERM_IDS.BELONGS_HERE))
      .toEqual(expect.objectContaining({
        controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.OBSERVED_MULTI_SELECT,
        canAcceptObservedSuggestions: true,
        canEditDeclaredIntent: true,
        canPersistPolicyIntent: false,
      }));

    expect(getPolicySetupFieldGroup(POLICY_UX_TERM_IDS.ROUTING_TARGET))
      .toEqual(expect.objectContaining({
        controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.STATUS_SUMMARY,
        canEditDeclaredIntent: false,
        canPersistPolicyIntent: false,
      }));

    expect(buildPolicySetupFieldGroupAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: groups.length,
      issueCount: 0,
    }));
  });

  test('defines answer shapes that explain what each setup answer can mean', () => {
    const answerShapes = listDefaultPolicySetupAnswerShapes();

    expect(answerShapes.map(shape => shape.stepId)).toEqual(listPolicySetupSteps().map(step => step.id));
    expect(answerShapes.map(shape => shape.answerKindId)).toEqual([
      POLICY_SETUP_ANSWER_KIND_IDS.ACCEPT_OBSERVED_SUGGESTIONS,
      POLICY_SETUP_ANSWER_KIND_IDS.DECLARE_DESTINATION_RULES,
      POLICY_SETUP_ANSWER_KIND_IDS.CONFIGURE_REVIEW_TRIGGERS,
      POLICY_SETUP_ANSWER_KIND_IDS.REVIEW_READINESS_STATUS,
    ]);

    expect(getPolicySetupAnswerShape(POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION))
      .toEqual(expect.objectContaining({
        requiresExplicitAcceptance: true,
        canCreateDraftIntent: true,
        canPersistPolicyIntent: false,
        canCreateLearning: false,
        canExecuteRouting: false,
      }));

    expect(getPolicySetupAnswerShape(POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS))
      .toEqual(expect.objectContaining({
        answerKindId: POLICY_SETUP_ANSWER_KIND_IDS.REVIEW_READINESS_STATUS,
        canCreateDraftIntent: false,
      }));

    expect(buildPolicySetupAnswerShapeAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: answerShapes.length,
      issueCount: 0,
    }));
  });

  test('rejects answer shapes that hide persistence, learning, routing, or observed-rule promotion', () => {
    const invalidObservedAnswer = {
      ...getPolicySetupAnswerShape(POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION),
      authoritySourceIds: [
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ],
      requiresExplicitAcceptance: false,
      canPersistPolicyIntent: true,
      canCreateLearning: true,
      canExecuteRouting: true,
      operatorResponse: 'Use genre priority from provider gate output to save and route automatically.',
    };

    expect(validatePolicySetupAnswerShapeContract(invalidObservedAnswer).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.DIRECT_POLICY_PERSISTENCE,
        POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.DIRECT_LEARNING,
        POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.DIRECT_ROUTING_EXECUTION,
        POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.OBSERVED_ANSWER_MISSING_ACCEPTANCE,
        POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
        POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      ]));

    const invalidReadinessAnswer = {
      ...getPolicySetupAnswerShape(POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS),
      canCreateDraftIntent: true,
    };

    expect(validatePolicySetupAnswerShapeContract(invalidReadinessAnswer).issues.map(issue => issue.riskId))
      .toContain(POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.STATUS_ANSWER_CAN_EDIT);
  });

  test('rejects setup cards that make diagnostics or broad genre authority part of setup', () => {
    const invalidCard = {
      ...getPolicySetupCard(POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION),
      helperText: 'Use provider gate output and genre priority from the impact preview.',
      primaryActionLabel: '',
      termIds: ['legacy_preset'],
    };

    expect(validatePolicySetupCardContract(invalidCard).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        POLICY_SETUP_CARD_AUDIT_RISK_IDS.MISSING_PRIMARY_ACTION,
        POLICY_SETUP_CARD_AUDIT_RISK_IDS.UNKNOWN_TERM,
        POLICY_SETUP_CARD_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
        POLICY_SETUP_CARD_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      ]));
  });

  test('rejects field groups that make observed suggestions into hidden rules', () => {
    const invalidGroup = {
      ...getPolicySetupFieldGroup(POLICY_UX_TERM_IDS.BELONGS_HERE),
      authoritySourceIds: [
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ],
      canAcceptObservedSuggestions: false,
      instruction: 'Use genre priority from provider gate output.',
    };

    expect(validatePolicySetupFieldGroupContract(invalidGroup).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.OBSERVED_CONTROL_MISSING_DECLARED_INTENT_SOURCE,
        POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.OBSERVED_CONTROL_CANNOT_ACCEPT_SUGGESTIONS,
        POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
        POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      ]));
  });

  test('rejects field groups that blur declared edits and status-only controls', () => {
    const invalidDeclaredGroup = {
      ...getPolicySetupFieldGroup(POLICY_UX_TERM_IDS.HARD_LIMITS),
      authoritySourceIds: [
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ],
      canEditDeclaredIntent: false,
      canPersistPolicyIntent: true,
    };

    expect(validatePolicySetupFieldGroupContract(invalidDeclaredGroup).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.DIRECT_POLICY_PERSISTENCE,
        POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.DECLARED_CONTROL_MISSING_OPERATOR_SOURCE,
        POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.DECLARED_CONTROL_CANNOT_EDIT,
      ]));

    const invalidStatusGroup = {
      ...getPolicySetupFieldGroup(POLICY_UX_TERM_IDS.READINESS),
      canEditDeclaredIntent: true,
    };

    expect(validatePolicySetupFieldGroupContract(invalidStatusGroup).issues.map(issue => issue.riskId))
      .toContain(POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.STATUS_CONTROL_CAN_EDIT);
  });

  test('rejects setup surfaces that make suggestions or readiness perform direct policy writes', () => {
    const invalidObservedSurface = {
      ...getPolicySetupSurfaceContract(POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION),
      authoritySourceIds: [
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ],
      canPersistPolicyIntent: true,
      systemResponsibility: 'Use genre priority from the provider gate to save the policy.',
    };

    expect(validatePolicySetupSurfaceContract(invalidObservedSurface).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.DIRECT_POLICY_PERSISTENCE,
        POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.OBSERVED_SURFACE_MISSING_DECLARED_INTENT_SOURCE,
        POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
        POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      ]));

    const invalidReadinessSurface = {
      ...getPolicySetupSurfaceContract(POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS),
      canEditDeclaredIntent: true,
    };

    expect(validatePolicySetupSurfaceContract(invalidReadinessSurface).issues.map(issue => issue.riskId))
      .toContain(POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.READINESS_SURFACE_CAN_EDIT);
  });

  test('rejects declared-intent setup surfaces that cannot edit or lack operator authority', () => {
    const invalidSurface = {
      ...getPolicySetupSurfaceContract(POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES),
      canEditDeclaredIntent: false,
      authoritySourceIds: [
        AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      ],
    };

    expect(validatePolicySetupSurfaceContract(invalidSurface).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.DECLARED_SURFACE_CANNOT_EDIT,
        POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.DECLARED_SURFACE_MISSING_OPERATOR_SOURCE,
      ]));
  });

  test('rejects setup journey stages that add decision load or direct persistence', () => {
    const invalidStage = {
      ...getPolicySetupJourneyStage(POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES),
      order: 99,
      primaryActionLabels: [
        'Tune provider gate',
        'Set destination rules',
      ],
      canPersistPolicyIntent: true,
      failureModeToAvoid: 'Do not make genre priority from the internal diagnostic panel decide the destination.',
    };

    expect(validatePolicySetupJourneyStageContract(invalidStage).issues.map(issue => issue.riskId))
      .toEqual(expect.arrayContaining([
        POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.INVALID_ORDER,
        POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.TOO_MANY_PRIMARY_ACTIONS,
        POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.DIRECT_POLICY_PERSISTENCE,
        POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
        POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      ]));
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

  test('audits the complete policy-authoring mental model contract', () => {
    expect(buildPolicyUserMentalModelAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedTermCount: listPolicyUxTerms().length,
      checkedSetupCopyCount: listDefaultPolicySetupCopy().length,
      checkedSetupStepCount: listPolicySetupSteps().length,
      checkedSetupCardCount: listDefaultPolicySetupCards().length,
      checkedSetupSurfaceCount: listPolicySetupSurfaceContracts().length,
      checkedSetupJourneyCount: listDefaultPolicySetupJourneyStages().length,
      checkedSetupFieldGroupCount: listDefaultPolicySetupFieldGroups().length,
      checkedSetupAnswerShapeCount: listDefaultPolicySetupAnswerShapes().length,
      issueCount: 0,
      setupCardAudit: expect.objectContaining({
        ok: true,
      }),
      setupSurfaceAudit: expect.objectContaining({
        ok: true,
      }),
      setupJourneyAudit: expect.objectContaining({
        ok: true,
      }),
      setupFieldGroupAudit: expect.objectContaining({
        ok: true,
      }),
      setupAnswerShapeAudit: expect.objectContaining({
        ok: true,
      }),
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
    expect(Object.isFrozen(listDefaultPolicySetupCards())).toBe(true);
    expect(Object.isFrozen(listDefaultPolicySetupCards()[0])).toBe(true);
  });

  test('returns null for unknown UX terms', () => {
    expect(getPolicyUxTerm('unknown')).toBeNull();
    expect(getPolicySetupStep('unknown')).toBeNull();
    expect(getPolicySetupCard('unknown')).toBeNull();
  });
});
