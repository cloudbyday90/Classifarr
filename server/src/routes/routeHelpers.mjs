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
