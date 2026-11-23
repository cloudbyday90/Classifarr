/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { MAX_DATABASE_BIGINT_ID } from './databaseIntegerValues.mjs';

export { normalizeDatabaseBigintId as parseRetryTargetId } from './databaseIntegerValues.mjs';

export const RETRY_TARGET_ID_VALIDATION_MESSAGE =
  `classificationIds must contain positive safe integer numbers or canonical decimal strings from 1 to ${MAX_DATABASE_BIGINT_ID}`;
