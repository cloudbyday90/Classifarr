export const PROFILE_SCORE_NEUTRAL_BASELINE = 50;

export function parseConfiguredNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
        return null;
    }

    const parsedValue = Number(trimmedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function getLibraryConflictKey(library) {
    if (!library) {
        return null;
    }

    if (library.id !== undefined && library.id !== null) {
        return `id:${String(library.id)}`;
    }

    if (typeof library.name === 'string' && library.name.trim().length > 0) {
        return `name:${library.name.trim().toLowerCase()}`;
    }

    return null;
}

export function compareLibraries(left, right) {
    const leftName = String(left?.name || '');
    const rightName = String(right?.name || '');
    if (leftName !== rightName) {
        return leftName.localeCompare(rightName);
    }

    return String(left?.id || '').localeCompare(String(right?.id || ''));
}

export function normalizeNumericPrecision(value) {
    return Number(value.toFixed(6));
}
