/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
function parseDaysConfig(days) {
    if (!days) {
        return [0, 1, 2, 3, 4, 5, 6];
    }

    if (Array.isArray(days)) {
        return days.map((day) => Number.parseInt(day, 10));
    }

    if (typeof days === 'string') {
        return days.split(',').map((day) => Number.parseInt(day, 10));
    }

    return [0, 1, 2, 3, 4, 5, 6];
}

function formatDaysConfig(days) {
    if (!days || !Array.isArray(days)) {
        return '0,1,2,3,4,5,6';
    }

    return days.join(',');
}

const backfillHelpers = {
    parseDaysConfig,
    formatDaysConfig
};

export { parseDaysConfig, formatDaysConfig };
export default backfillHelpers;
