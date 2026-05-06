/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import { jest } from '@jest/globals';

export function createMockLogger() {
	return {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	};
}

export const loggerMockFactory = () => {
	const mockLogger = createMockLogger();
	const factory = () => mockLogger;
	return {
		createLogger: factory,
		setLoggerDb: jest.fn(),
		default: {
			createLogger: factory,
			setLoggerDb: jest.fn(),
		},
	};
};

export function createStandardDbMock(query) {
	return {
		default: { query },
	};
}

export function createTestApp(router, middleware = []) {
	const app = express();
	app.use(express.json());
	for (const mw of middleware) {
		app.use(mw);
	}
	return app;
}
