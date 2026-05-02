/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import policyQuestionContext from './policyQuestionContext.shared.js';

const {
  buildQuestionContextCacheKey,
  extractQuestionContext,
  getPolicyQuestionContextVersion,
  isPolicyQuestionStale,
  stampPolicyQuestionContext,
} = policyQuestionContext;

export {
  buildQuestionContextCacheKey,
  extractQuestionContext,
  getPolicyQuestionContextVersion,
  isPolicyQuestionStale,
  stampPolicyQuestionContext,
};

export default policyQuestionContext;
