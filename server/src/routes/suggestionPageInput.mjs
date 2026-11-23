/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseCanonicalDatabaseInt32Id } from '../services/databaseIntegerValues.mjs';
import { ValidationError } from '../utils/appError.mjs';

const PAGE_PARAMETERS = new Set(['status', 'policyId', 'beforeId']);
const PAGE_STATUSES = new Set(['pending', 'applied', 'rejected', 'superseded', 'all']);

function readOptionalId(query, key) {
    if (!Object.hasOwn(query, key)) return null;
    const id = parseCanonicalDatabaseInt32Id(query[key]);
    if (id === null) throw new ValidationError(`${key} must be a decimal ID from 1 to 2147483647.`);
    return id;
}

export function readSuggestionPageInput(query) {
    if (Object.keys(query).some(key => !PAGE_PARAMETERS.has(key))) {
        throw new ValidationError('Use only status, policyId and beforeId to read a suggestion page.');
    }
    const status = query.status ?? 'pending';
    if (!PAGE_STATUSES.has(status)) {
        throw new ValidationError('status must be pending, applied, rejected, superseded or all.');
    }
    return {
        status: status === 'all' ? null : status,
        policyId: readOptionalId(query, 'policyId'),
        beforeId: readOptionalId(query, 'beforeId'),
    };
}
