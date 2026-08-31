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

/**
 * Centralized rate-limit configuration objects.
 *
 * These are plain option objects consumed by `rateLimit(config)` from
 * express-rate-limit. Keeping configs here allows tuning of all limits
 * in one place without touching route logic.
 *
 * Route files that receive `rateLimit` via dependency injection pass
 * these config objects to the injected function, preserving testability.
 */

/** Auth — login attempts (per IP, per 15 minutes). */
export const loginLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** Auth — token refresh (per IP, per 15 minutes). */
export const refreshLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many refresh attempts' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** Auth — password change (per IP, per hour). */
export const passwordChangeLimiterConfig = {
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many password change attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** General authenticated endpoints (per IP, per 15 minutes). */
export const generalAuthLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** API key management endpoints (per IP, per 15 minutes). */
export const apiKeyLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many API key requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** Logs query endpoints (per IP, per 15 minutes). */
export const logsLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many log requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** Ollama strict-verification runtime aggregate reads (per IP, per 15 minutes). */
export const ollamaVerificationRuntimeMismatchSummaryLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many Ollama runtime observation requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** Ollama saved-capability aggregate history reads (per IP, per 15 minutes). */
export const ollamaVerificationCapabilityOutcomeHistoryLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many Ollama verification history requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** Manual Ollama compatibility matrix diagnostics (per IP, per hour). */
export const ollamaVerificationCompatibilityMatrixLimiterConfig = {
  windowMs: 60 * 60 * 1000,
  max: 2,
  message: { error: 'Too many Ollama compatibility matrix requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** Policy custom intent-signal validation (per IP, per 15 minutes). */
export const policyIntentSignalCustomEntryLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many custom intent-signal validations, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
};

/** Policy native-constraint write admission (per IP, per 15 minutes). */
export const policyConstraintWriteAdmissionLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many constraint admission requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
};

/** Policy authoring proposal preparation and admission (per IP, per 15 minutes). */
export const policyAuthoringProposalLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many policy proposal requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
};

/** Representative historical-review corpus control acknowledgements (per IP, per 15 minutes). */
export const policyCandidateCorrectionReviewCorpusControlLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many review-corpus safeguard acknowledgements, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
};

/** Redacted representative review-projection reads (per IP, per 15 minutes). */
export const policyCandidateCorrectionReviewProjectionReadLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many review-projection requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
};

/** Redacted representative review-projection creation (per IP, per 15 minutes). */
export const policyCandidateCorrectionReviewProjectionCreateLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many review-projection creation requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
};

/** Settings — SSL connectivity test (per IP, per hour). */
export const sslTestLimiterConfig = {
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many SSL test attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/** Setup wizard endpoints (per IP, per hour). */
export const setupLimiterConfig = {
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many setup attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * User profile update (per IP, per hour).
 * Skipped in test environments to avoid interference with route tests.
 */
export const profileUpdateLimiterConfig = {
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many profile update attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
};

/** Webhook ingestion endpoints (per IP, per 15 minutes). */
export const webhookLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many webhook requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};
