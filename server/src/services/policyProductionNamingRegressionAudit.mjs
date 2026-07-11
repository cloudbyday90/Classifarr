const POLICY_PRODUCTION_NAMING_REGRESSION_AUDIT_VERSION =
  'policy.production_naming_regression_audit.v1';
const TEMPORARY_ADAPTER_WITH_DELETION_GATE = 'temporary_adapter_with_deletion_gate';

const POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE = Object.freeze({
  label: 'classification-rag-loop-stage-ratchet-2026-07-11',
  maxProductionReferenceCount: 32,
  maxRenameCandidateCount: 33,
  maxObsoleteToolingCount: 0,
});

const POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS = Object.freeze({
  MISSING_INVENTORY: 'missing_inventory',
  INVENTORY_INVALID: 'inventory_invalid',
  PRODUCTION_REFERENCE_INCREASED: 'production_reference_increased',
  RENAME_CANDIDATE_INCREASED: 'rename_candidate_increased',
  OBSOLETE_TOOLING_INCREASED: 'obsolete_tooling_increased',
  ADAPTER_DELETION_GATE_MISSING: 'adapter_deletion_gate_missing',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function buildRisk(riskId, message, details = {}) {
  return {
    riskId,
    message,
    ...details,
  };
}

function getSummaryCount(summary, key) {
  return asCount(asObject(summary)[key]);
}

function buildPolicyProductionNamingRegressionAudit(options = {}) {
  const inventory = options.inventory || null;
  const baseline = {
    ...POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE,
    ...asObject(options.baseline),
  };
  const risks = [];

  if (!inventory) {
    risks.push(buildRisk(
      POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.MISSING_INVENTORY,
      'Production naming regression audit requires a generated inventory.'
    ));
  }

  const summary = asObject(inventory?.summary);
  const validation = asObject(inventory?.validation);
  const productionReferenceCount = getSummaryCount(summary, 'productionReferenceCount');
  const renameCandidateCount = getSummaryCount(summary, 'renameCandidateCount');
  const obsoleteToolingCount = getSummaryCount(summary, 'obsoleteToolingCount');

  if (inventory && validation.ok !== true) {
    risks.push(buildRisk(
      POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.INVENTORY_INVALID,
      'Production naming inventory must be valid before regression auditing.',
      {
        inventoryRiskCount: asCount(validation.riskCount),
      }
    ));
  }

  if (productionReferenceCount > baseline.maxProductionReferenceCount) {
    risks.push(buildRisk(
      POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.PRODUCTION_REFERENCE_INCREASED,
      'Temporary production naming references increased beyond the approved baseline.',
      {
        currentCount: productionReferenceCount,
        baselineCount: baseline.maxProductionReferenceCount,
      }
    ));
  }

  if (renameCandidateCount > baseline.maxRenameCandidateCount) {
    risks.push(buildRisk(
      POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.RENAME_CANDIDATE_INCREASED,
      'Temporary production rename candidates increased beyond the approved baseline.',
      {
        currentCount: renameCandidateCount,
        baselineCount: baseline.maxRenameCandidateCount,
      }
    ));
  }

  if (obsoleteToolingCount > baseline.maxObsoleteToolingCount) {
    risks.push(buildRisk(
      POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.OBSOLETE_TOOLING_INCREASED,
      'Obsolete migration tooling references increased beyond the approved baseline.',
      {
        currentCount: obsoleteToolingCount,
        baselineCount: baseline.maxObsoleteToolingCount,
      }
    ));
  }

  asArray(inventory?.references)
    .filter(reference =>
      reference.decisionId === TEMPORARY_ADAPTER_WITH_DELETION_GATE &&
      !reference.adapterDeletionGate
    )
    .forEach(reference => {
      risks.push(buildRisk(
        POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.ADAPTER_DELETION_GATE_MISSING,
        'Temporary production naming adapters must have a deletion gate.',
        {
          repoPath: reference.repoPath,
          lineNumber: reference.lineNumber,
        }
      ));
    });

  Object.entries(asObject(inventory?.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (sideEffectId !== 'filesRead' && performed === true) {
      risks.push(buildRisk(
        POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Production naming regression audit cannot accept side effect "${sideEffectId}".`,
        {
          sideEffectId,
        }
      ));
    }
  });

  return {
    version: POLICY_PRODUCTION_NAMING_REGRESSION_AUDIT_VERSION,
    ok: risks.length === 0,
    riskCount: risks.length,
    baseline,
    summary: {
      productionReferenceCount,
      renameCandidateCount,
      obsoleteToolingCount,
      remainingProductionRenameCount: renameCandidateCount,
    },
    deltas: {
      productionReferenceDelta:
        productionReferenceCount - baseline.maxProductionReferenceCount,
      renameCandidateDelta:
        renameCandidateCount - baseline.maxRenameCandidateCount,
      obsoleteToolingDelta:
        obsoleteToolingCount - baseline.maxObsoleteToolingCount,
    },
    risks,
    nextAction: risks.length === 0
      ? {
          id: 'continue_durable_module_cutover',
          label: 'Continue durable module cutover',
          reason:
            'Temporary production naming debt did not increase beyond the approved baseline.',
        }
      : {
          id: 'reduce_or_classify_new_temporary_references',
          label: 'Reduce or classify new temporary references',
          reason:
            'New or unbounded temporary production references must be removed, renamed, or explicitly gated.',
        },
  };
}

export {
  POLICY_PRODUCTION_NAMING_REGRESSION_AUDIT_VERSION,
  POLICY_PRODUCTION_NAMING_REGRESSION_BASELINE,
  POLICY_PRODUCTION_NAMING_REGRESSION_RISK_IDS,
  buildPolicyProductionNamingRegressionAudit,
};
