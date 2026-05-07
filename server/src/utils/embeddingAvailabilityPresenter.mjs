/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function getStatusLabel(status) {
    switch (status) {
    case 'cooldown':
        return 'Cooling Down';
    case 'probing':
        return 'Probing';
    case 'probe_due':
        return 'Probe Due';
    default:
        return 'Available';
    }
}

function getStatusFlag(status) {
    switch (status) {
    case 'cooldown':
        return 'WAIT';
    case 'probing':
        return 'TEST';
    case 'probe_due':
        return 'HOLD';
    default:
        return 'ON';
    }
}

function getHeadline(status) {
    switch (status) {
    case 'cooldown':
        return 'Embedding provider cooling down';
    case 'probing':
        return 'Embedding provider recovery probe in progress';
    case 'probe_due':
        return 'Embedding provider recovery probe pending';
    default:
        return 'Embedding provider available';
    }
}

function getDefaultDetail(status) {
    switch (status) {
    case 'cooldown':
    case 'probing':
    case 'probe_due':
        return 'Queued embedding work is paused until the provider passes a recovery probe.';
    default:
        return 'Embedding work can run normally.';
    }
}

function getTone(status) {
    switch (status) {
    case 'cooldown':
        return 'danger';
    case 'probing':
    case 'probe_due':
        return 'warning';
    default:
        return 'success';
    }
}

export function presentEmbeddingAvailability(rawStatus = {}) {
    const status = rawStatus.status || 'available';
    const retryAt = rawStatus.retryAt || rawStatus.cooldownUntil || null;

    return {
        ...rawStatus,
        status,
        retryAt,
        presentation: {
            statusLabel: getStatusLabel(status),
            flag: getStatusFlag(status),
            headline: getHeadline(status),
            detail: rawStatus.lastError || getDefaultDetail(status),
            tone: getTone(status)
        },
        controls: {
            canRunJobs: status === 'available',
            canStartManualBackfill: status === 'available',
            canResumeManualBackfill: status === 'available',
            queuedWorkPaused: status !== 'available'
        }
    };
}
