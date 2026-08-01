/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ServiceUnavailableError } from '../utils/appError.mjs';
import {
  buildPolicyOperatorWorkflowReadAudit,
} from '../services/policyOperatorWorkflowReadService.mjs';

const POLICY_OPERATOR_WORKFLOW_READ_UNAVAILABLE_CODE =
  'POLICY_OPERATOR_WORKFLOW_READ_UNAVAILABLE';

function listPolicyOperatorWorkflowReadAuditRiskIds(audit = {}) {
  return Array.from(new Set(
    (Array.isArray(audit.issues) ? audit.issues : [])
      .map(issue => typeof issue?.riskId === 'string' ? issue.riskId : '')
      .filter(Boolean),
  ));
}

function assertPolicyOperatorWorkflowReadResponse({ result, libraryId, logger } = {}) {
  const audit = buildPolicyOperatorWorkflowReadAudit(result);
  if (audit.ok) return audit;

  logger?.error('Policy operator workflow read failed validation', {
    libraryId: Number.isInteger(libraryId) ? libraryId : null,
    auditRiskIds: listPolicyOperatorWorkflowReadAuditRiskIds(audit),
  });
  throw new ServiceUnavailableError(
    'Classifarr could not prepare a safe policy workflow. Please try again.',
    { code: POLICY_OPERATOR_WORKFLOW_READ_UNAVAILABLE_CODE },
  );
}

export {
  POLICY_OPERATOR_WORKFLOW_READ_UNAVAILABLE_CODE,
  assertPolicyOperatorWorkflowReadResponse,
  listPolicyOperatorWorkflowReadAuditRiskIds,
};
