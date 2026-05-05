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

import { jest } from '@jest/globals';

const {
	buildAiUnavailableResult,
	resolveClassificationPathAiFailure,
	resolveAiUnavailableResult,
} = await import('../services/classificationPathServiceShared.mjs');

describe('classificationPathServiceShared', () => {
	it('builds a pending retry result when AI availability is transient', () => {
		const buildPendingRetryResult = jest.fn().mockReturnValue({ needs_retry: true });
		const libraries = [{ id: 1, name: 'Movies' }];

		const result = buildAiUnavailableResult({
			isTransientAiAvailability: true,
			confidence: 30,
			suggestedLibrary: null,
			libraries,
			signalContext: { confidence: 30 },
			transientError: new Error('timeout'),
			previousRetryCount: 1,
			maxRetries: 3,
			buildPendingRetryResult,
			signalCalculationReason: 'Calculated from signals (AI unavailable)',
		});

		expect(buildPendingRetryResult).toHaveBeenCalledWith(expect.objectContaining({
			confidence: 30,
			libraries,
			previousRetryCount: 1,
			maxRetries: 3,
		}));
		expect(result).toEqual({ needs_retry: true });
	});

	it('builds a signal_calculation result when confidence is strong and a library is suggested', () => {
		const suggestedLibrary = { id: 1, name: 'Movies' };

		const result = buildAiUnavailableResult({
			isTransientAiAvailability: false,
			confidence: 65,
			suggestedLibrary,
			libraries: [suggestedLibrary, { id: 2, name: 'Shows' }],
			signalContext: { confidence: 65 },
			transientError: new Error('AI error'),
			previousRetryCount: 0,
			maxRetries: 3,
			buildPendingRetryResult: jest.fn(),
			signalCalculationReason: 'Calculated from policy signals (AI unavailable)',
			signalCalculationResultFields: {
				policyResult: { confidence: 65 },
			},
		});

		expect(result).toEqual(expect.objectContaining({
			library: suggestedLibrary,
			confidence: 65,
			method: 'signal_calculation',
			reason: 'Calculated from policy signals (AI unavailable)',
			policyResult: { confidence: 65 },
		}));
	});

	it('builds a fallback result when no suggested library is available', () => {
		const libraries = [{ id: 1, name: 'Movies' }, { id: 2, name: 'Shows' }];

		const result = buildAiUnavailableResult({
			isTransientAiAvailability: false,
			confidence: 65,
			suggestedLibrary: null,
			libraries,
			signalContext: { confidence: 65 },
			transientError: new Error('AI error'),
			previousRetryCount: 0,
			maxRetries: 3,
			buildPendingRetryResult: jest.fn(),
			signalCalculationReason: 'Calculated from signals (AI unavailable)',
		});

		expect(result).toEqual({
			library: libraries[1],
			confidence: 50,
			method: 'fallback',
			reason: 'Default library - AI unavailable (fell back to Shows)',
			libraries,
		});
	});

	it('returns the retry result directly without calling ensureDecisionQuestion', async () => {
		const buildPendingRetryResult = jest.fn().mockReturnValue({ needs_retry: true });
		const ensureDecisionQuestion = jest.fn();

		const result = await resolveAiUnavailableResult({
			metadata: { title: 'Test Film' },
			policyResult: null,
			ragContext: null,
			ensureDecisionQuestion,
			isTransientAiAvailability: true,
			confidence: 30,
			suggestedLibrary: null,
			libraries: [{ id: 1, name: 'Movies' }],
			signalContext: { confidence: 30 },
			transientError: new Error('timeout'),
			previousRetryCount: 1,
			maxRetries: 3,
			buildPendingRetryResult,
			signalCalculationReason: 'Calculated from signals (AI unavailable)',
		});

		expect(result).toEqual({ needs_retry: true });
		expect(ensureDecisionQuestion).not.toHaveBeenCalled();
	});

	it('wraps a non-retry fallback result through ensureDecisionQuestion', async () => {
		const ensureDecisionQuestion = jest.fn().mockImplementation(async ({ result }) => ({
			...result,
			clarification: true,
		}));
		const libraries = [{ id: 1, name: 'Movies' }, { id: 2, name: 'Shows' }];

		const result = await resolveAiUnavailableResult({
			metadata: { title: 'Test Film' },
			policyResult: { confidence: 65 },
			ragContext: { similarItems: [] },
			ensureDecisionQuestion,
			isTransientAiAvailability: false,
			confidence: 65,
			suggestedLibrary: null,
			libraries,
			signalContext: { confidence: 65 },
			transientError: new Error('AI error'),
			previousRetryCount: 0,
			maxRetries: 3,
			buildPendingRetryResult: jest.fn(),
			signalCalculationReason: 'Calculated from signals (AI unavailable)',
		});

		expect(ensureDecisionQuestion).toHaveBeenCalledWith({
			metadata: { title: 'Test Film' },
			result: {
				library: libraries[1],
				confidence: 50,
				method: 'fallback',
				reason: 'Default library - AI unavailable (fell back to Shows)',
				libraries,
			},
			policyResult: { confidence: 65 },
			libraries,
			ragContext: { similarItems: [] },
		});
		expect(result).toEqual(expect.objectContaining({
			method: 'fallback',
			clarification: true,
		}));
	});

	it('logs transient AI failures and queues retry details through the shared path helper', async () => {
		const logger = {
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
		};
		const isAiTransientAvailabilityError = jest.fn().mockReturnValue(true);
		const ensureDecisionQuestion = jest.fn();
		const buildPendingRetryResult = jest.fn().mockReturnValue({ needs_retry: true });
		const error = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });

		const result = await resolveClassificationPathAiFailure({
			logger,
			error,
			metadata: { title: 'Test Film', tmdb_id: 111 },
			ensureDecisionQuestion,
			isAiTransientAvailabilityError,
			policyResult: null,
			ragContext: null,
			confidence: 30,
			suggestedLibrary: null,
			libraries: [{ id: 1, name: 'Movies' }],
			signalContext: { confidence: 30 },
			previousRetryCount: 1,
			maxRetries: 3,
			buildPendingRetryResult,
			signalCalculationReason: 'Calculated from signals (AI unavailable)',
		});

		expect(isAiTransientAvailabilityError).toHaveBeenCalledWith(error);
		expect(logger.warn).toHaveBeenCalledWith('AI classification temporarily unavailable', {
			error: 'timeout',
			code: 'ETIMEDOUT',
		});
		expect(logger.error).not.toHaveBeenCalled();
		expect(logger.info).toHaveBeenCalledWith('AI unavailable/busy - queuing for retry', {
			confidence: 30,
			tmdbId: 111,
			title: 'Test Film',
			transient_ai_availability: true,
		});
		expect(ensureDecisionQuestion).not.toHaveBeenCalled();
		expect(result).toEqual({ needs_retry: true });
	});

	it('logs non-transient AI failures without retry queue logging when fallback can proceed', async () => {
		const logger = {
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
		};
		const isAiTransientAvailabilityError = jest.fn().mockReturnValue(false);
		const ensureDecisionQuestion = jest.fn().mockImplementation(async ({ result }) => result);
		const error = new Error('GPU OOM');
		const libraries = [{ id: 1, name: 'Movies' }, { id: 2, name: 'Shows' }];

		const result = await resolveClassificationPathAiFailure({
			logger,
			error,
			metadata: { title: 'Test Film', tmdb_id: 111 },
			ensureDecisionQuestion,
			isAiTransientAvailabilityError,
			policyResult: { confidence: 65 },
			ragContext: { similarItems: [] },
			confidence: 65,
			suggestedLibrary: null,
			libraries,
			signalContext: { confidence: 65 },
			previousRetryCount: 1,
			maxRetries: 3,
			buildPendingRetryResult: jest.fn(),
			signalCalculationReason: 'Calculated from signals (AI unavailable)',
		});

		expect(logger.warn).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith('AI classification failed', { error: 'GPU OOM' });
		expect(logger.info).not.toHaveBeenCalled();
		expect(ensureDecisionQuestion).toHaveBeenCalledTimes(1);
		expect(result).toEqual(expect.objectContaining({ method: 'fallback' }));
	});
});
