/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { buildPolicyConfigurationView } from './policyConfigurationView.mjs';
import { buildPolicyIntentContract } from './policyIntentContract.mjs';

export function buildPolicyIntentProjection(policy = {}) {
  const configurationView = policy.configuration_view || buildPolicyConfigurationView(policy);
  const policyIntentContract = policy.policy_intent_contract || buildPolicyIntentContract(policy, {
    configurationView,
  });

  return {
    configuration_view: configurationView,
    policy_intent_contract: policyIntentContract,
  };
}

export function withPolicyIntentProjection(policy = {}) {
  const projection = buildPolicyIntentProjection(policy);

  return {
    ...policy,
    ...projection,
  };
}
