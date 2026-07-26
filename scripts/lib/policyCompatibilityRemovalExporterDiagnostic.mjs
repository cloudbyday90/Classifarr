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

const POLICY_COMPATIBILITY_REMOVAL_EXPORTER_DIAGNOSTIC_VERSION =
  'policy.compatibility_removal_exporter_diagnostic.v1';

const POLICY_COMPATIBILITY_REMOVAL_EXPORTER_IDS = Object.freeze({
  POST_REMOVAL_VERIFICATION: 'post_removal_verification',
  NEXT_BATCH_AUTHORIZATION: 'next_batch_authorization',
  COMPLETION_AUDIT: 'completion_audit',
  EVIDENCE_REGENERATION: 'evidence_regeneration',
  STORAGE_CLOSURE_FINAL_REMOVAL_AUDIT: 'storage_closure_final_removal_audit',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildPolicyCompatibilityRemovalExporterDiagnostic({
  exporterId = '',
  runtimeEvidenceCutover = {},
} = {}) {
  const cutover = runtimeEvidenceCutover &&
    typeof runtimeEvidenceCutover === 'object' &&
    !Array.isArray(runtimeEvidenceCutover)
    ? runtimeEvidenceCutover
    : {};
  const reasonIds = [...new Set(
    asArray(cutover.reasonIds)
      .map(reasonId => String(reasonId || '').trim())
      .filter(Boolean)
  )].sort();

  return {
    version: POLICY_COMPATIBILITY_REMOVAL_EXPORTER_DIAGNOSTIC_VERSION,
    statusId: 'blocked',
    authoritative: false,
    exporterId,
    runtimeEvidenceContract: {
      requiredVersion: cutover.requiredRuntimeEvidenceVersion || null,
      reasonIds,
    },
    nextStep: {
      stepId: cutover.nextStep?.stepId || 'regenerate_current_runtime_evidence',
      label: cutover.nextStep?.label || 'Regenerate Current Runtime Evidence',
      reason: cutover.nextStep?.reason ||
        'The public compatibility-removal chain requires current runtime evidence.',
    },
  };
}

export {
  POLICY_COMPATIBILITY_REMOVAL_EXPORTER_DIAGNOSTIC_VERSION,
  POLICY_COMPATIBILITY_REMOVAL_EXPORTER_IDS,
  buildPolicyCompatibilityRemovalExporterDiagnostic,
};
