/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION =
  'policy.runtime_question_persistence.v1';
const POLICY_RUNTIME_QUESTION_REDUCTION_VERSION =
  'policy.runtime_question_reduction.v1';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isPolicyRuntimeQuestionPersistenceEnvelope(value = {}) {
  const question = asObject(value);
  return question.version === POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION &&
    question.runtimeQuestion?.contractVersion === POLICY_RUNTIME_QUESTION_REDUCTION_VERSION &&
    question.runtimeQuestionReductionPlan?.version === POLICY_RUNTIME_QUESTION_REDUCTION_VERSION;
}

export {
  POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
  POLICY_RUNTIME_QUESTION_REDUCTION_VERSION,
  isPolicyRuntimeQuestionPersistenceEnvelope,
};
