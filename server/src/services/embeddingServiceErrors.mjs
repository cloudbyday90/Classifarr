/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export function createProviderOfflineError(status = {}) {
    const error = new Error('PROVIDER_OFFLINE');
    error.code = 'EMBEDDING_PROVIDER_OFFLINE';
    error.cooldownUntil = status.cooldownUntil || null;
    error.lastError = status.lastError || null;
    return error;
}

export function createProviderBusyError(upstreamError = null) {
    const error = new Error('PROVIDER_BUSY');
    error.code = 'EMBEDDING_PROVIDER_BUSY';
    error.lockHolder = upstreamError?.lockHolder || upstreamError?.lockedBy || null;
    error.waitMs = Number.isFinite(Number(upstreamError?.waitMs)) ? Number(upstreamError.waitMs) : null;
    error.activeModel = upstreamError?.activeModel || null;
    error.preemptRequested = upstreamError?.preemptRequested === true;
    error.reasonCode = error.preemptRequested
        ? 'embedding_preempted_by_classification'
        : 'embedding_provider_busy';
    error.lastError = upstreamError?.message || null;
    return error;
}

export function isProviderPreemptedError(error) {
    const message = error?.message || '';
    return (
        (error?.code === 'EMBEDDING_PROVIDER_BUSY' && error?.preemptRequested === true) ||
        error?.reasonCode === 'embedding_preempted_by_classification' ||
        message.includes('preempted by high-priority classification request')
    );
}

export function isProviderBusyError(error) {
    const message = error?.message || '';
    return error?.code === 'EMBEDDING_PROVIDER_BUSY' ||
        error?.code === 'PROVIDER_LOCK_TIMEOUT' ||
        message === 'PROVIDER_BUSY' ||
        message.includes('[ProviderLock] Timeout waiting for lock') ||
        isProviderPreemptedError(error);
}

export function isProviderConnectionError(error) {
    const message = error?.message || '';
    const code = error?.code || '';

    return code === 'EMBEDDING_CIRCUIT_OPEN' ||
        code === 'EMBEDDING_PROVIDER_OFFLINE' ||
        message.includes('PROVIDER_OFFLINE') ||
        message.includes('Circuit breaker is OPEN') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ETIMEDOUT') ||
        message.includes('ENOTFOUND') ||
        message.includes('EHOSTUNREACH') ||
        message.includes('fetch failed') ||
        message.includes('Failed to fetch models');
}
