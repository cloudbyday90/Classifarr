import { ValidationError, NotFoundError } from '../utils/appError.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';

export function requireRow(result, message = 'Resource not found') {
  if (result.rows.length === 0) {
    throw new NotFoundError(message);
  }
  return result;
}

export function requireValidId(value, label = 'ID') {
  const id = parseIntParam(value, null, 1);
  if (id === null) {
    throw new ValidationError(`Invalid ${label}`);
  }
  return id;
}

export function requireValidPositiveInt(value, label, code) {
  const parsed = parseIntParam(value, null, 1);
  if (parsed === null) {
    throw new ValidationError(`Valid ${label} is required`, { code });
  }
  return parsed;
}

export function requireValidLimit(value, defaultValue, maxValue, code) {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseIntParam(value, null, 1);
  if (parsed === null || parsed > maxValue) {
    throw new ValidationError(`Valid positive limit up to ${maxValue} is required`, { code, max: maxValue });
  }
  return parsed;
}
