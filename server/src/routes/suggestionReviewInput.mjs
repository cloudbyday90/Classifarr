/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseCanonicalDatabaseInt32Id } from '../services/databaseIntegerValues.mjs';
import { ForbiddenError, ValidationError } from '../utils/appError.mjs';

export function requireSuggestionAdministratorId(actor) {
  const userId = parseCanonicalDatabaseInt32Id(actor);
  if (userId === null) {
    throw new ForbiddenError('Valid administrator identity required');
  }
  return userId;
}

export function readSuggestionId(suggestion) {
  const suggestionId = parseCanonicalDatabaseInt32Id(suggestion);
  if (suggestionId === null) {
    throw new ValidationError('Invalid suggestion ID. Use a whole number from 1 to 2147483647 in decimal form.');
  }

  return suggestionId;
}

export function readSuggestionReviewIds(suggestion, actor) {
  const userId = requireSuggestionAdministratorId(actor);
  return { suggestionId: readSuggestionId(suggestion), userId };
}
