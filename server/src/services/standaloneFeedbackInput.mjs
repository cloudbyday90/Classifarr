/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Buffer } from 'node:buffer';
import { ValidationError } from '../utils/appError.mjs';

const fields = new Set(['classification_id', 'selected_library_id', 'selected_policy_id', 'user_reason', 'user_reason_text']);

function positiveId(value, name, maximum) {
    const text = typeof value === 'string' ? value : Number.isSafeInteger(value) ? String(value) : '';
    if (!/^[1-9]\d{0,18}$/.test(text) || BigInt(text) > maximum) {
        throw new ValidationError(`${name} must be a positive integer within its supported range`);
    }
    return text;
}

function annotation(value, name, bytes) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.includes('\0') || Buffer.byteLength(value, 'utf8') > bytes) {
        throw new ValidationError(`${name} must be text of at most ${bytes} bytes`);
    }
    return value.trim() || null;
}

export function normalizeStandaloneFeedback(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Invalid feedback request');
    if (Object.keys(body).some(key => !fields.has(key))) {
        throw new ValidationError('Only classification_id, selected_library_id, selected_policy_id and reason annotations are accepted');
    }
    return {
        classification_id: positiveId(body.classification_id, 'classification_id', 9223372036854775807n),
        selected_library_id: Number(positiveId(body.selected_library_id, 'selected_library_id', 2147483647n)),
        selected_policy_id: Number(positiveId(body.selected_policy_id, 'selected_policy_id', 2147483647n)),
        user_reason: annotation(body.user_reason, 'user_reason', 100),
        user_reason_text: annotation(body.user_reason_text, 'user_reason_text', 4000),
    };
}
