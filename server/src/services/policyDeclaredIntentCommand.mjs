import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';

const POLICY_DECLARED_INTENT_COMMAND_VERSION = 'policy.declared_intent_command.v1';
const MAX_PROPOSAL_REFERENCE_LENGTH = 120;
const MAX_DECLARED_VALUES_PER_FIELD = 50;

const POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS = Object.freeze({
  READY: 'ready',
  INVALID_COMMAND: 'invalid_command',
  UNAUTHORIZED_ACTOR: 'unauthorized_actor',
  PROPOSAL_UNAVAILABLE: 'proposal_unavailable',
  PROPOSAL_NOT_READY: 'proposal_not_ready',
  PROPOSAL_FINGERPRINT_MISMATCH: 'proposal_fingerprint_mismatch',
  VERIFIED_HANDOFF_FINGERPRINT_MISMATCH: 'verified_handoff_fingerprint_mismatch',
  MISSING_DESTINATION_IDENTITY: 'missing_destination_identity',
  CONFIRMATION_REQUIRED: 'confirmation_required',
  COMMAND_FAILED: 'command_failed',
});

const POLICY_DECLARED_INTENT_COMMAND_RISK_IDS = Object.freeze({
  INVALID_COMMAND: 'invalid_command',
  UNAUTHORIZED_ACTOR: 'unauthorized_actor',
  PROPOSAL_UNAVAILABLE: 'proposal_unavailable',
  PROPOSAL_NOT_READY: 'proposal_not_ready',
  PROPOSAL_FINGERPRINT_MISMATCH: 'proposal_fingerprint_mismatch',
  MISSING_DESTINATION_IDENTITY: 'missing_destination_identity',
  HARD_LIMIT_CONFIRMATION_REQUIRED: 'hard_limit_confirmation_required',
  COMMAND_FAILED: 'declared_intent_command_failed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  BLOCKED_WITH_NEXT_STEP: 'blocked_with_next_step',
});

const POLICY_DECLARED_INTENT_FIELD_IDS = Object.freeze({
  BELONGS_HERE: 'belongsHere',
  HELPFUL_MATCHES: 'helpfulMatches',
  HARD_LIMITS: 'hardLimits',
  AVOID: 'avoid',
  ROUTING_TARGETS: 'routingTargets',
});

const POLICY_DECLARED_INTENT_CONFIRMATION_IDS = Object.freeze({
  HARD_LIMITS: 'hard_limits',
});

const DECLARED_INTENT_FIELD_IDS = Object.freeze(Object.values(POLICY_DECLARED_INTENT_FIELD_IDS));
const CONFIRMATION_IDS = Object.freeze(Object.values(POLICY_DECLARED_INTENT_CONFIRMATION_IDS));
const COMMAND_INPUT_KEYS = Object.freeze([
  'proposalReference',
  'proposalFingerprint',
  'declaredIntent',
  'confirmedFields',
  'actor',
]);
const HEX_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSideEffects({ proposalResolved = false } = {}) {
  return {
    proposalResolved,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    policyStorageMutated: false,
    learningMutated: false,
    routingAttempted: false,
  };
}

function buildProposalSummary(proposal = {}) {
  const source = asPlainObject(proposal);
  const provenance = asPlainObject(source.evidenceProvenance);
  const fingerprint = asPlainObject(provenance.projectionFingerprint);
  const handoffAudit = asPlainObject(source.handoffAudit);
  const verifiedFingerprint = asPlainObject(handoffAudit.projectionFingerprint);

  return {
    libraryId: Number.isInteger(provenance.libraryId) ? provenance.libraryId : null,
    statusId: normalizeString(source.statusId) || null,
    fingerprint: normalizeString(fingerprint.fingerprint) || null,
    verifiedHandoffFingerprint: normalizeString(verifiedFingerprint.fingerprint) || null,
    handoffAuditOk: handoffAudit.ok === true,
  };
}

function buildCommandResult({
  statusId,
  ok,
  issue = null,
  proposal = null,
  command = null,
  proposalResolved = false,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_DECLARED_INTENT_COMMAND_VERSION,
    ok,
    statusId,
    issueCount: issues.length,
    issues,
    proposal: buildProposalSummary(proposal),
    command: ok ? command : null,
    sideEffects: buildSideEffects({ proposalResolved }),
    nextStep: ok
      ? {
        stepId: 'policy_intent_persistence_gate',
        label: 'Policy Intent Persistence Gate',
        reason: 'The declared intent command is authorized and fingerprint-bound, but native policy storage remains a separate server-owned capability.',
      }
      : null,
  };
}

function validateActor(actor = {}) {
  const source = asPlainObject(actor);
  const actorId = Number(source.id);

  return {
    valid: source.authenticated === true &&
      Number.isInteger(actorId) &&
      actorId > 0 &&
      source.role === 'admin',
    actor: {
      id: Number.isInteger(actorId) && actorId > 0 ? actorId : null,
      role: normalizeString(source.role) || null,
    },
  };
}

function normalizeDeclaredIntent(input = {}) {
  const source = asPlainObject(input);
  const issues = [];
  const unknownKeys = Object.keys(source)
    .filter(key => !DECLARED_INTENT_FIELD_IDS.includes(key));

  if (unknownKeys.length > 0) {
    issues.push({
      riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.INVALID_COMMAND,
      message: 'Declared intent contains unsupported fields.',
    });
  }

  const declaredIntent = Object.fromEntries(DECLARED_INTENT_FIELD_IDS.map(fieldId => {
    const values = source[fieldId] === undefined ? [] : source[fieldId];
    if (!Array.isArray(values) || values.length > MAX_DECLARED_VALUES_PER_FIELD) {
      issues.push({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.INVALID_COMMAND,
        message: 'Declared intent field values must be bounded string lists.',
      });
      return [fieldId, []];
    }

    const normalizedValues = values.map(normalizeString);
    if (normalizedValues.some(value => !value || value.length > 120)) {
      issues.push({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.INVALID_COMMAND,
        message: 'Declared intent values must be non-empty bounded strings.',
      });
    }

    return [fieldId, [...new Set(normalizedValues.filter(Boolean))]];
  }));

  return {
    valid: issues.length === 0,
    declaredIntent,
    issues,
  };
}

function validateCommandInput(input = {}) {
  const source = asPlainObject(input);
  const issues = [];
  const unknownKeys = Object.keys(source)
    .filter(key => !COMMAND_INPUT_KEYS.includes(key));
  const proposalReference = normalizeString(source.proposalReference);
  const proposalFingerprint = normalizeString(source.proposalFingerprint);
  const confirmedFields = Array.isArray(source.confirmedFields)
    ? [...new Set(source.confirmedFields.map(normalizeString).filter(Boolean))]
    : [];
  const declaredIntentResult = normalizeDeclaredIntent(source.declaredIntent);

  if (unknownKeys.length > 0 ||
      !proposalReference ||
      proposalReference.length > MAX_PROPOSAL_REFERENCE_LENGTH ||
      !HEX_FINGERPRINT_PATTERN.test(proposalFingerprint) ||
      !Array.isArray(source.confirmedFields) ||
      confirmedFields.some(fieldId => !CONFIRMATION_IDS.includes(fieldId))) {
    issues.push({
      riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.INVALID_COMMAND,
      message: 'Declared intent command is not valid for this contract version.',
    });
  }

  issues.push(...declaredIntentResult.issues);

  if (declaredIntentResult.declaredIntent.belongsHere.length === 0) {
    issues.push({
      riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.MISSING_DESTINATION_IDENTITY,
      message: 'Declared intent command requires at least one destination identity value.',
    });
  }

  return {
    valid: issues.length === 0,
    proposalReference,
    proposalFingerprint,
    confirmedFields,
    declaredIntent: declaredIntentResult.declaredIntent,
    actor: source.actor,
    issues,
  };
}

function buildCommand({ input, actor, proposal }) {
  return {
    version: POLICY_DECLARED_INTENT_COMMAND_VERSION,
    proposalReference: input.proposalReference,
    proposalFingerprint: input.proposalFingerprint,
    verifiedHandoffFingerprint: proposal.verifiedHandoffFingerprint,
    libraryId: proposal.libraryId,
    actor,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    declaredIntent: input.declaredIntent,
    confirmedFields: input.confirmedFields,
  };
}

function createPolicyDeclaredIntentCommandService({
  resolveProposal = null,
} = {}) {
  async function submitDeclaredIntentCommand(input = {}) {
    const normalizedInput = validateCommandInput(input);
    if (!normalizedInput.valid) {
      return buildCommandResult({
        statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.INVALID_COMMAND,
        ok: false,
        issue: normalizedInput.issues[0],
      });
    }

    const actorResult = validateActor(normalizedInput.actor);
    if (!actorResult.valid) {
      return buildCommandResult({
        statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.UNAUTHORIZED_ACTOR,
        ok: false,
        issue: {
          riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.UNAUTHORIZED_ACTOR,
          message: 'Declared intent command requires an authenticated administrator.',
        },
      });
    }

    if (typeof resolveProposal !== 'function') {
      return buildCommandResult({
        statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.PROPOSAL_UNAVAILABLE,
        ok: false,
        issue: {
          riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.PROPOSAL_UNAVAILABLE,
          message: 'Declared intent command could not resolve a server-owned proposal.',
        },
      });
    }

    let proposal;
    try {
      proposal = await resolveProposal({
        proposalReference: normalizedInput.proposalReference,
        actor: actorResult.actor,
      });
    } catch {
      return buildCommandResult({
        statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.PROPOSAL_UNAVAILABLE,
        ok: false,
        issue: {
          riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.PROPOSAL_UNAVAILABLE,
          message: 'Declared intent command could not resolve a server-owned proposal.',
        },
      });
    }

    const proposalSummary = buildProposalSummary(proposal);
    if (proposal?.ok !== true || proposal?.statusId !== 'ready' ||
        proposal?.intent?.version !== 'policy.intent.v1' ||
        !Number.isInteger(proposalSummary.libraryId) || !proposalSummary.fingerprint ||
        !proposalSummary.handoffAuditOk || !proposalSummary.verifiedHandoffFingerprint) {
      return buildCommandResult({
        statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.PROPOSAL_NOT_READY,
        ok: false,
        proposal,
        proposalResolved: true,
        issue: {
          riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.PROPOSAL_NOT_READY,
          message: 'Declared intent command requires a ready server-owned proposal.',
        },
      });
    }

    if (proposalSummary.fingerprint !== normalizedInput.proposalFingerprint) {
      return buildCommandResult({
        statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.PROPOSAL_FINGERPRINT_MISMATCH,
        ok: false,
        proposal,
        proposalResolved: true,
        issue: {
          riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.PROPOSAL_FINGERPRINT_MISMATCH,
          message: 'Declared intent command no longer matches the server-owned proposal.',
        },
      });
    }

    if (proposalSummary.fingerprint !== proposalSummary.verifiedHandoffFingerprint) {
      return buildCommandResult({
        statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.PROPOSAL_NOT_READY,
        ok: false,
        proposal,
        proposalResolved: true,
        issue: {
          riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.VERIFIED_HANDOFF_FINGERPRINT_MISMATCH,
          message: 'Declared intent command requires proposal provenance that matches the verified handoff.',
        },
      });
    }

    if (normalizedInput.declaredIntent.hardLimits.length > 0 &&
        !normalizedInput.confirmedFields.includes(POLICY_DECLARED_INTENT_CONFIRMATION_IDS.HARD_LIMITS)) {
      return buildCommandResult({
        statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.CONFIRMATION_REQUIRED,
        ok: false,
        proposal,
        proposalResolved: true,
        issue: {
          riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.HARD_LIMIT_CONFIRMATION_REQUIRED,
          message: 'Declared hard limits require explicit confirmation.',
        },
      });
    }

    return buildCommandResult({
      statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.READY,
      ok: true,
      proposal,
      proposalResolved: true,
      command: buildCommand({
        input: normalizedInput,
        actor: actorResult.actor,
        proposal: proposalSummary,
      }),
    });
  }

  return {
    submitDeclaredIntentCommand,
  };
}

function buildPolicyDeclaredIntentCommandAudit(result = {}) {
  const commandResult = asPlainObject(result);
  const issues = [];
  const ok = commandResult.ok === true;

  if (!Object.values(POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS).includes(commandResult.statusId)) {
    issues.push({
      riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.COMMAND_FAILED,
      message: 'Declared intent command returned an unknown status.',
    });
  }

  if (commandResult.issueCount !== (Array.isArray(commandResult.issues) ? commandResult.issues.length : 0)) {
    issues.push({
      riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.COMMAND_FAILED,
      message: 'Declared intent command issue count must match returned issues.',
    });
  }

  const command = asPlainObject(commandResult.command);
  const proposal = asPlainObject(commandResult.proposal);
  const declaredIntent = asPlainObject(command.declaredIntent);
  const hardLimitConfirmed = Array.isArray(command.confirmedFields) &&
    command.confirmedFields.includes(POLICY_DECLARED_INTENT_CONFIRMATION_IDS.HARD_LIMITS);

  if (ok && (!commandResult.command ||
      command.authoritySourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT ||
      !command.proposalFingerprint ||
      command.proposalFingerprint !== proposal.fingerprint ||
      !command.verifiedHandoffFingerprint ||
      command.verifiedHandoffFingerprint !== proposal.verifiedHandoffFingerprint ||
      command.proposalFingerprint !== command.verifiedHandoffFingerprint ||
      !Number.isInteger(command.libraryId) ||
      command.libraryId !== proposal.libraryId ||
      command.actor?.role !== 'admin' ||
      (Array.isArray(declaredIntent.hardLimits) && declaredIntent.hardLimits.length > 0 && !hardLimitConfirmed))) {
    issues.push({
      riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.COMMAND_FAILED,
      message: 'Ready declared intent command requires an authorized fingerprint-bound command envelope.',
    });
  }

  if (!ok && commandResult.nextStep !== null) {
    issues.push({
      riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.BLOCKED_WITH_NEXT_STEP,
      message: 'Blocked declared intent commands cannot advance to persistence.',
    });
  }

  Object.entries(asPlainObject(commandResult.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && sideEffectId !== 'proposalResolved') {
      issues.push({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Declared intent command must not perform live lookups, writes, learning, or routing.',
        sideEffectId,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_DECLARED_INTENT_COMMAND_RISK_IDS,
  POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS,
  POLICY_DECLARED_INTENT_COMMAND_VERSION,
  POLICY_DECLARED_INTENT_CONFIRMATION_IDS,
  POLICY_DECLARED_INTENT_FIELD_IDS,
  buildPolicyDeclaredIntentCommandAudit,
  createPolicyDeclaredIntentCommandService,
};
