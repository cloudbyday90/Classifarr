/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ForbiddenError, ValidationError } from '../utils/appError.mjs';

export function requirePolicySimulationAdministrator(req) {
  if (req.user?.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
}

export function requirePolicySimulationId(value, { codePrefix } = {}) {
  const policyId = Number(value);
  if (!Number.isInteger(policyId) || policyId <= 0) {
    throw new ValidationError('A valid policy identifier is required.', {
      code: `${codePrefix}_POLICY_ID_INVALID`,
    });
  }

  return policyId;
}

export function requirePolicySimulationDraft(body, { codePrefix, label } = {}) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const unexpectedFields = Object.keys(payload).filter(field => field !== 'policy_intent_draft');
  if (unexpectedFields.length > 0) {
    throw new ValidationError(`${label} accepts only policy_intent_draft.`, {
      code: `${codePrefix}_REQUEST_INVALID`,
    });
  }

  if (payload.policy_intent_draft === undefined) {
    throw new ValidationError(`A policy intent draft is required for ${label.toLowerCase()}.`, {
      code: `${codePrefix}_DRAFT_REQUIRED`,
    });
  }

  return payload.policy_intent_draft;
}
