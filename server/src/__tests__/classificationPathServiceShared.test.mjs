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

const { buildAiUnavailableResult } = await import('../services/classificationPathServiceShared.mjs');

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
});
