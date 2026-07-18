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
  buildPolicyIntentContract,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_SOURCES,
} from './policyIntentContract.mjs';
import {
  buildPolicyLibraryProfileInitialIntentContract,
} from './policyLibraryProfileInitialIntent.mjs';

const POLICY_NATIVE_INTENT_CONVERSION_MODES = Object.freeze({
  LEGACY_PRESET_CONVERSION: 'legacy_preset_conversion',
  LIBRARY_PROFILE_INITIALIZATION: 'library_profile_initialization',
});

function buildPolicyNativeIntentConversionContract({ policy = {}, now = new Date() } = {}) {
  const legacyContract = buildPolicyIntentContract(policy);
  const needsInitialProfileIntent =
    legacyContract.source === POLICY_INTENT_SOURCES.EMPTY &&
    legacyContract.inference_state === POLICY_INTENT_INFERENCE_STATES.EMPTY;

  if (!needsInitialProfileIntent) {
    return {
      mode: POLICY_NATIVE_INTENT_CONVERSION_MODES.LEGACY_PRESET_CONVERSION,
      legacyContract,
      contract: legacyContract,
      initialization: null,
    };
  }

  const initialization = buildPolicyLibraryProfileInitialIntentContract({ policy, now });
  return {
    mode: POLICY_NATIVE_INTENT_CONVERSION_MODES.LIBRARY_PROFILE_INITIALIZATION,
    legacyContract,
    contract: initialization.contract,
    initialization: {
      mode: initialization.mode,
      sourceId: initialization.sourceId,
      statusId: initialization.statusId,
      reasonId: initialization.reasonId,
      ready: initialization.ready,
      profile: initialization.profile,
    },
  };
}

export {
  POLICY_NATIVE_INTENT_CONVERSION_MODES,
  buildPolicyNativeIntentConversionContract,
};
