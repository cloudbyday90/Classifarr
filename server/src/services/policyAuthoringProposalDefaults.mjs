/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const DEFAULT_POLICY_AUTHORING_NATIVE_POLICY = Object.freeze({
  description: null,
  enabled: true,
  priority: 5,
  sortOrder: 0,
  autoClassifyThreshold: 85,
  promptThreshold: 60,
  requireAiValidation: true,
  trustPatterns: true,
  trustRag: true,
  trustHistory: true,
  presetWeight: 0.35,
  profileWeight: 0.25,
  patternWeight: 0.15,
  ragWeight: 0.15,
  historyWeight: 0.10,
  combinationMode: 'best_match',
});

export function buildPolicyAuthoringNativePolicy({ libraryId, policyName } = {}) {
  return {
    ...DEFAULT_POLICY_AUTHORING_NATIVE_POLICY,
    libraryId,
    name: policyName,
  };
}

export {
  DEFAULT_POLICY_AUTHORING_NATIVE_POLICY,
};
