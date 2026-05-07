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

function normalizeAiUnavailableConfidence(confidence) {
	return Number(confidence) || 0;
}

function shouldQueueAiUnavailableRetry({ isTransientAiAvailability, confidence }) {
	return isTransientAiAvailability || normalizeAiUnavailableConfidence(confidence) < 50;
}

export function buildAiUnavailableResult({
	isTransientAiAvailability,
	confidence,
	suggestedLibrary,
	libraries,
	signalContext,
	transientError,
	previousRetryCount,
	maxRetries,
	buildPendingRetryResult,
	signalCalculationReason,
	signalCalculationResultFields = {},
}) {
	const resolvedConfidence = normalizeAiUnavailableConfidence(confidence);

	if (shouldQueueAiUnavailableRetry({ isTransientAiAvailability, confidence: resolvedConfidence })) {
		return buildPendingRetryResult({
			confidence: resolvedConfidence,
			libraries,
			signalContext,
			transientError,
			previousRetryCount,
			maxRetries,
		});
	}

	if (suggestedLibrary && resolvedConfidence >= 50) {
		return {
			library: suggestedLibrary,
			confidence: resolvedConfidence,
			method: 'signal_calculation',
			reason: signalCalculationReason,
			libraries,
			...signalCalculationResultFields,
		};
	}

	const fallbackLibrary = libraries[libraries.length - 1];
	return {
		library: fallbackLibrary,
		confidence: 50,
		method: 'fallback',
		reason: `Default library - AI unavailable (fell back to ${fallbackLibrary.name})`,
		libraries,
	};
}

export async function resolveAiUnavailableResult({
	metadata,
	policyResult = null,
	ragContext = null,
	ensureDecisionQuestion,
	...buildArgs
}) {
	const result = buildAiUnavailableResult(buildArgs);

	if (shouldQueueAiUnavailableRetry(buildArgs)) {
		return result;
	}

	return ensureDecisionQuestion({
		metadata,
		result,
		policyResult,
		libraries: buildArgs.libraries,
		ragContext,
	});
}

export async function resolveClassificationPathAiFailure({
	logger,
	error,
	metadata,
	ensureDecisionQuestion,
	isAiTransientAvailabilityError,
	confidence,
	suggestedLibrary,
	libraries,
	signalContext,
	previousRetryCount,
	maxRetries,
	buildPendingRetryResult,
	signalCalculationReason,
	signalCalculationResultFields = {},
	policyResult = null,
	ragContext = null,
}) {
	const isTransientAiAvailability = isAiTransientAvailabilityError(error);

	if (isTransientAiAvailability) {
		logger.warn('AI classification temporarily unavailable', {
			error: error.message,
			code: error.code,
		});
	} else {
		logger.error('AI classification failed', { error: error.message });
	}

	if (shouldQueueAiUnavailableRetry({ isTransientAiAvailability, confidence })) {
		logger.info('AI unavailable/busy - queuing for retry', {
			confidence: normalizeAiUnavailableConfidence(confidence),
			tmdbId: metadata.tmdb_id,
			title: metadata.title,
			transient_ai_availability: isTransientAiAvailability,
		});
	}

	return resolveAiUnavailableResult({
		metadata,
		policyResult,
		ragContext,
		ensureDecisionQuestion,
		isTransientAiAvailability,
		confidence,
		suggestedLibrary,
		libraries,
		signalContext,
		transientError: error,
		previousRetryCount,
		maxRetries,
		buildPendingRetryResult,
		signalCalculationReason,
		signalCalculationResultFields,
	});
}
