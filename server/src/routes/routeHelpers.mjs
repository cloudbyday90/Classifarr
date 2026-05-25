import { ValidationError } from '../utils/appError.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';

/** @internal */
export function sendNotFound(res, message = 'Resource not found') {
  return res.status(404).json({ error: message });
}

export function requireRow(result, res, message = 'Resource not found') {
  if (result.rows.length === 0) {
    return sendNotFound(res, message);
  }
  return null;
}

export function requireValidId(value, label = 'ID') {
  const id = parseIntParam(value, null, 1);
  if (id === null) {
    throw new ValidationError(`Invalid ${label}`);
  }
  return id;
}
