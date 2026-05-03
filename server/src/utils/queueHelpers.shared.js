/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function safeParseInt(value, fallback = 0) {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePayload(payload) {
	if (typeof payload === 'string') {
		try {
			return JSON.parse(payload);
		} catch {
			return {};
		}
	}
	return payload || {};
}

function createTaskResult(success, extra = {}) {
	return { success, ...extra };
}

module.exports = { safeParseInt, parsePayload, createTaskResult };
