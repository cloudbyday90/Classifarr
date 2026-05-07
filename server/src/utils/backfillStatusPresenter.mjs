/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
function getManualPresentation(status, rawStatus) {
    switch (status) {
    case 'running':
        return {
            statusLabel: 'Running',
            headline: 'Manual backfill running',
            detail: `${rawStatus.processed || 0} of ${rawStatus.total || 0} items processed.`,
            tone: 'info'
        };
    case 'paused':
        return {
            statusLabel: 'Paused',
            headline: 'Manual backfill paused',
            detail: rawStatus.error || 'Manual backfill is paused.',
            tone: 'warning'
        };
    case 'cancelling':
        return {
            statusLabel: 'Cancelling',
            headline: 'Manual backfill stopping',
            detail: 'The current run is shutting down.',
            tone: 'warning'
        };
    case 'completed':
        return {
            statusLabel: 'Completed',
            headline: 'Manual backfill completed',
            detail: `${rawStatus.processed || 0} items processed.`,
            tone: 'success'
        };
    case 'failed':
        return {
            statusLabel: 'Failed',
            headline: 'Manual backfill failed',
            detail: rawStatus.error || 'Manual backfill failed.',
            tone: 'danger'
        };
    default:
        return {
            statusLabel: 'Idle',
            headline: 'Manual backfill idle',
            detail: 'No manual backfill is running.',
            tone: 'neutral'
        };
    }
}
function getIdlePresentation(status, rawStatus, availability) {
    if (status === 'running') {
        return {
            statusLabel: 'Running',
            headline: 'Idle backfill running',
            detail: 'Processing queued embeddings during an idle window.',
            tone: 'info'
        };
    }
    if (status === 'cooldown') {
        return {
            statusLabel: 'Waiting',
            headline: 'Idle backfill waiting on provider recovery',
            detail: availability?.presentation?.detail || 'Idle backfill is paused until the embedding provider recovers.',
            tone: 'warning'
        };
    }
    if (rawStatus.enabled) {
        return {
            statusLabel: 'Enabled',
            headline: 'Idle backfill enabled',
            detail: 'Idle backfill will run when the system is quiet.',
            tone: 'success'
        };
    }
    return {
        statusLabel: 'Disabled',
        headline: 'Idle backfill disabled',
        detail: 'Idle backfill is turned off.',
        tone: 'neutral'
    };
}
function getScheduledPresentation(status, rawStatus, availability) {
    if (status === 'running') {
        return {
            statusLabel: 'Running',
            headline: 'Scheduled backfill running',
            detail: 'The scheduled backfill window is active now.',
            tone: 'info'
        };
    }
    if (status === 'cooldown') {
        return {
            statusLabel: 'Waiting',
            headline: 'Scheduled backfill waiting on provider recovery',
            detail: availability?.presentation?.detail || 'Scheduled backfill is paused until the embedding provider recovers.',
            tone: 'warning'
        };
    }
    if (rawStatus.enabled) {
        return {
            statusLabel: 'Enabled',
            headline: 'Scheduled backfill enabled',
            detail: `Next runs follow the configured schedule at ${rawStatus.time || '02:00'}.`,
            tone: 'success'
        };
    }
    return {
        statusLabel: 'Disabled',
        headline: 'Scheduled backfill disabled',
        detail: 'Scheduled backfill is turned off.',
        tone: 'neutral'
    };
}
export function presentManualBackfillStatus(rawStatus = {}) {
    const status = rawStatus.status || 'idle';
    return {
        ...rawStatus,
        mode: 'manual',
        isRunning: status === 'running',
        isPaused: status === 'paused',
        isTerminal: ['completed', 'failed'].includes(status),
        controls: {
            canStart: !['running', 'paused', 'cancelling'].includes(status),
            canPause: status === 'running',
            canResume: status === 'paused',
            canClear: status !== 'running'
        },
        presentation: getManualPresentation(status, rawStatus)
    };
}
export function presentIdleBackfillStatus(rawStatus = {}, availability = null) {
    const providerWaiting = rawStatus.status === 'cooldown' || availability?.status === 'cooldown' || availability?.status === 'probing' || availability?.status === 'probe_due';
    const status = rawStatus.isRunning
        ? 'running'
        : providerWaiting && rawStatus.enabled
            ? 'cooldown'
            : (rawStatus.status || (rawStatus.enabled ? 'enabled' : 'disabled'));
    return {
        ...rawStatus,
        mode: 'idle',
        status,
        isRunning: status === 'running',
        isPaused: status === 'cooldown',
        isTerminal: false,
        controls: {
            canRun: rawStatus.enabled === true && status !== 'cooldown'
        },
        presentation: getIdlePresentation(status, rawStatus, availability)
    };
}
export function presentScheduledBackfillStatus(rawStatus = {}, availability = null) {
    const providerWaiting = availability?.status === 'cooldown' || availability?.status === 'probing' || availability?.status === 'probe_due';
    const status = rawStatus.isRunning
        ? 'running'
        : providerWaiting && rawStatus.enabled
            ? 'cooldown'
            : (rawStatus.status || (rawStatus.enabled ? 'enabled' : 'disabled'));
    return {
        ...rawStatus,
        mode: 'scheduled',
        status,
        isRunning: status === 'running',
        isPaused: status === 'cooldown',
        isTerminal: false,
        controls: {
            canRun: rawStatus.enabled === true && status !== 'cooldown'
        },
        presentation: getScheduledPresentation(status, rawStatus, availability)
    };
}

