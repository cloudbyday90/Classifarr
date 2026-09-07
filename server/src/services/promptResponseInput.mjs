/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Buffer } from 'node:buffer';
import { ValidationError } from '../utils/appError.mjs';

function positiveId(value, label) {
    const number = typeof value === 'number' || (typeof value === 'string' && /^[1-9]\d*$/.test(value))
        ? Number(value) : NaN;
    if (!Number.isSafeInteger(number) || number < 1 || number > 2147483647) {
        throw new ValidationError(`${label} must be a positive integer`);
    }
    return number;
}

function boundedText(value, label, maximumBytes) {
    if (typeof value !== 'string' || !value.trim() || value.includes('\0') ||
        Buffer.byteLength(value, 'utf8') > maximumBytes) {
        throw new ValidationError(`${label} must be nonempty text of at most ${maximumBytes} bytes`);
    }
    return value.trim();
}

export function normalizePromptResponse(body = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Invalid prompt response');
    if (body.selectedLibraryId === undefined) throw new ValidationError('selectedLibraryId is required');
    const selectedLibraryId = positiveId(body.selectedLibraryId, 'selectedLibraryId');
    const selectedPolicyId = body.selectedPolicyId == null ? null : positiveId(body.selectedPolicyId, 'selectedPolicyId');
    const actions = body.patternActions === undefined ? [] : body.patternActions;
    if (!Array.isArray(actions) || actions.length > 50) throw new ValidationError('patternActions must be an array of at most 50 actions');
    const unique = new Map();
    for (const action of actions) {
        if (!action || typeof action !== 'object' || Array.isArray(action)) throw new ValidationError('Invalid pattern action');
        const type = boundedText(action.type, 'Pattern type', 50);
        const value = boundedText(action.value, 'Pattern value', 1024);
        const targetLibraryId = action.targetLibraryId === undefined
            ? selectedLibraryId : positiveId(action.targetLibraryId, 'targetLibraryId');
        unique.set(JSON.stringify([type, value, targetLibraryId]), { type, value, targetLibraryId });
    }
    const reasons = body.reasons === undefined ? [] : body.reasons;
    if (!Array.isArray(reasons) || reasons.length > 20) throw new ValidationError('reasons must be an array of at most 20 items');
    return {
        selectedLibraryId, selectedPolicyId,
        patternActions: [...unique.values()],
        reasons: reasons.map(reason => boundedText(reason, 'Reason', 200)),
        customReason: body.customReason == null || body.customReason === ''
            ? null : boundedText(body.customReason, 'customReason', 4000),
    };
}
