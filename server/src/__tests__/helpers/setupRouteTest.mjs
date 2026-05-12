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
export {
	createDbMock,
	createLoggerModuleMock,
	createMockLogger,
	createStandardDbMock,
} from './mockFactory.mjs';

export function createTestApp(router, middleware = []) {
	const app = express();
	app.use(express.json());
	for (const mw of middleware) {
		app.use(mw);
	}
	return app;
}

export function createMountedTestApp({ basePath, router, middleware = [] }) {
	const app = createTestApp(undefined, middleware);
	app.use(basePath, router);
	return app;
}

export function createSettingsTestApp(settingsRouter) {
	const app = express();
	app.use(express.json());
	app.use('/settings', settingsRouter);
	return app;
}
