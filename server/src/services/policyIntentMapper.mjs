/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyIntentRuntimeReadPath,
} from './policyIntentRuntimeReadPath.mjs';

export function buildPolicyIntentProjection(policy = {}) {
  const readPath = buildPolicyIntentRuntimeReadPath({ policy });

  return {
    configuration_view: readPath.configuration_view,
    policy_intent_contract: readPath.policy_intent_contract,
    policy_intent_read_trace: readPath.trace,
  };
}

export function withPolicyIntentProjection(policy = {}) {
  const projection = buildPolicyIntentProjection(policy);

  return {
    ...policy,
    ...projection,
  };
}
