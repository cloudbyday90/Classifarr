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
import {
	buildClassificationPathAiResult,
	buildAiUnavailableResult,
	resolveClassificationPathAiFailure,
	resolveClassificationPathAiSuccess,
	resolveAiUnavailableResult,
} from '../services/classificationPathServiceShared.mjs';

describe('classificationPathServiceShared', () => {
	it('builds a shared AI result payload for classification paths', () => {
		const libraries = [{ id: 1, name: 'Movies' }];
		const signalContext = { confidence: 82 };
		const policyResult = { ranked: [{ library_id: 1, score: 82 }] };
		const ragContext = { similarItems: [{ tmdbId: 101 }] };

		const result = buildClassificationPathAiResult({
			aiMatch: {
				library: libraries[0],
				confidence: 82,
				verified_by_ai: true,
			},
			libraries,
			signalContext,
			policyResult,
			ragContext,
		});

		expect(result).toEqual({
			library: libraries[0],
			confidence: 82,
			verified_by_ai: true,
			method: 'ai_verified',
			libraries,
			signalContext,
			policyResult,
			ragContext,
		});
	});

	it('resolves a shared AI success path through second pass and decision question', async () => {
		const metadata = { title: 'Test Film', source_library_id: null };
		const libraries = [{ id: 1, name: 'Movies' }];
		const signalContext = { confidence: 82 };
		const policyResult = { ranked: [{ library_id: 1, score: 82 }] };
		const ragContext = { similarItems: [{ tmdbId: 101 }] };
		const classificationProgressStageService = { updateStage: jest.fn().mockResolvedValue(undefined) };
		const finalResult = { library: libraries[0], confidence: 83, method: 'ai_verified' };
		const classificationRagLoopService = {
			evaluateRagLoopSecondPass: jest.fn().mockResolvedValue(finalResult),
		};
		const ensureDecisionQuestion = jest.fn().mockImplementation(async ({ result }) => ({
			...result,
			clarification: true,
		}));

		const result = await resolveClassificationPathAiSuccess({
			metadata,
			aiMatch: {
				library: libraries[0],
				confidence: 82,
				verified_by_ai: false,
			},
			libraries,
			signalContext,
			policyResult,
			decisionPolicyResult: policyResult,
			ragContext,
			taskId: 'task-1',
			classificationProgressStageService,
			classificationRagLoopService,
			ensureDecisionQuestion,
		});

		expect(classificationProgressStageService.updateStage).toHaveBeenCalledWith('task-1', 'decision', {
			confidence: 82,
		});
		expect(classificationRagLoopService.evaluateRagLoopSecondPass).toHaveBeenCalledWith({
			metadata,
			libraries,
			baselineResult: {
				library: libraries[0],
				confidence: 82,
				verified_by_ai: false,
				method: 'ai_analysis',
				libraries,
				signalContext,
				policyResult,
				ragContext,
			},
			policyResult,
			signalContext,
			ragContext,
		});
		expect(ensureDecisionQuestion).toHaveBeenCalledWith({
			metadata,
			result: finalResult,
			policyResult,
			libraries,
			ragContext,
		});
		expect(result).toEqual(expect.objectContaining({
			method: 'ai_verified',
			clarification: true,
		}));
	});

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
		expect(result).toEqual(expect.objectContaining({
			needs_retry: true,
			provider_recovery: {
				version: 'provider_recovery.v1',
				mode: 'retry_queued',
			},
		}));
	});

	it('labels a low-confidence provider fallback as retry recovery even when the failure is permanent', () => {
		const result = buildAiUnavailableResult({
			isTransientAiAvailability: false,
			confidence: 30,
			suggestedLibrary: null,
			libraries: [{ id: 1, name: 'Movies' }],
			signalContext: { confidence: 30 },
			transientError: new Error('provider authorization rejected'),
			previousRetryCount: 0,
			maxRetries: 3,
			buildPendingRetryResult: jest.fn().mockReturnValue({ needs_retry: true }),
			signalCalculationReason: 'Calculated from policy signals (AI unavailable)',
		});

		expect(result.provider_recovery).toEqual({
			version: 'provider_recovery.v1',
			mode: 'retry_queued',
		});
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
			provider_recovery: {
				version: 'provider_recovery.v1',
				mode: 'review_required',
			},
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
			provider_recovery: {
				version: 'provider_recovery.v1',
				mode: 'review_required',
			},
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

		expect(result).toEqual(expect.objectContaining({
			needs_retry: true,
			provider_recovery: expect.objectContaining({ mode: 'retry_queued' }),
		}));
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
				provider_recovery: {
					version: 'provider_recovery.v1',
					mode: 'review_required',
				},
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
		expect(logger.warn).toHaveBeenCalledWith(
			'AI classification temporarily unavailable',
			{
				error: 'timeout',
				code: 'ETIMEDOUT',
			},
			expect.objectContaining({
				dedupeKey: expect.stringContaining('ai-provider-runtime:classification_temporarily_unavailable:'),
			})
		);
		expect(logger.error).not.toHaveBeenCalled();
		expect(logger.info).toHaveBeenCalledWith('AI unavailable/busy - queuing for retry', {
			confidence: 30,
			tmdbId: 111,
			title: 'Test Film',
			transient_ai_availability: true,
		});
		expect(ensureDecisionQuestion).not.toHaveBeenCalled();
		expect(result).toEqual(expect.objectContaining({
			needs_retry: true,
			provider_recovery: expect.objectContaining({ mode: 'retry_queued' }),
		}));
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
		expect(result).toEqual(expect.objectContaining({
			method: 'fallback',
			provider_recovery: expect.objectContaining({ mode: 'review_required' }),
		}));
	});
});
