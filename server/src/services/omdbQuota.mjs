/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('OMDbService');

export class OMDbLimitReachedError extends Error {
	constructor(message) {
		super(message);
		this.name = 'OMDbLimitReachedError';
	}
}

export async function hasRemainingQuota() {
	try {
		const result = await db.query('SELECT * FROM omdb_config WHERE is_active = true LIMIT 1');
		const config = result.rows[0];

		if (!config || !config.api_key) {
			return { available: false, used: 0, limit: 0, reason: 'OMDb API key not configured' };
		}

		const today = new Date().toLocaleDateString('en-CA');
		const lastReset = config.last_reset_date
			? (typeof config.last_reset_date === 'string'
				? config.last_reset_date.split('T')[0]
				: new Date(config.last_reset_date).toLocaleDateString('en-CA'))
			: null;

		let requestsToday = config.requests_today || 0;

		if (lastReset !== today) {
			requestsToday = 0;
		}

		const limit = config.daily_limit || 1000;
		const available = requestsToday < limit;

		return { available, used: requestsToday, limit };
	} catch (error) {
		return { available: false, used: 0, limit: 0, reason: error.message };
	}
}

export async function checkAndIncrementUsage({ metadataProviderIntegrityService }) {
	try {
		const result = await db.query('SELECT * FROM omdb_config WHERE is_active = true LIMIT 1');
		const config = result.rows[0];

		if (!config || !config.api_key) {
			throw new Error('OMDb API key not configured');
		}

		const today = new Date().toLocaleDateString('en-CA');
		const lastReset = config.last_reset_date
			? (typeof config.last_reset_date === 'string'
				? config.last_reset_date.split('T')[0]
				: new Date(config.last_reset_date).toLocaleDateString('en-CA'))
			: null;

		let requestsToday = config.requests_today || 0;

		if (lastReset !== today) {
			logger.info('Resetting OMDb daily limit counter for new day', { today, lastReset });
			requestsToday = 0;
			await db.query('UPDATE omdb_config SET requests_today = 0, last_reset_date = CURRENT_DATE WHERE id = $1', [config.id]);
		}

		if (requestsToday >= config.daily_limit) {
			metadataProviderIntegrityService.warnProviderRuntimeFailure({
				provider: 'omdb',
				category: 'daily_limit',
				message: 'OMDb daily limit reached',
				metadata: {
					source: 'omdb_service',
					limit: config.daily_limit,
					used: requestsToday
				},
				dedupeSignature: `${today}:${config.daily_limit}:${requestsToday}`
			});
			throw new OMDbLimitReachedError(`OMDb daily limit of ${config.daily_limit} reached`);
		}

		return { apiKey: config.api_key, configId: config.id };
	} catch (error) {
		if (error.name === 'OMDbLimitReachedError') throw error;
		throw new Error(`Failed to check OMDb usage: ${error.message}`);
	}
}

export async function incrementUsageCounter(configId) {
	try {
		await db.query('UPDATE omdb_config SET requests_today = requests_today + 1 WHERE id = $1', [configId]);
		logger.debug('OMDb usage counter incremented', { configId });
	} catch (error) {
		logger.error('Failed to increment OMDb counter', { error: error.message });
	}
}
