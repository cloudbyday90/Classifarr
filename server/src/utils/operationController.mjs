/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import operationController from './operationController.shared.js';

const {
	OperationController,
	createController,
	DEFAULT_TIMEOUT_MS,
	DEFAULT_INITIAL_TIMEOUT_MS,
	DEFAULT_HEARTBEAT_TIMEOUT_MS,
	DEFAULT_HARD_TIMEOUT_MS,
} = operationController;

export default operationController;
export {
	OperationController,
	createController,
	DEFAULT_TIMEOUT_MS,
	DEFAULT_INITIAL_TIMEOUT_MS,
	DEFAULT_HEARTBEAT_TIMEOUT_MS,
	DEFAULT_HARD_TIMEOUT_MS,
};

export const _DEFAULT_INITIAL_TIMEOUT_MS = DEFAULT_INITIAL_TIMEOUT_MS;
export const _DEFAULT_HEARTBEAT_TIMEOUT_MS = DEFAULT_HEARTBEAT_TIMEOUT_MS;
export const _DEFAULT_HARD_TIMEOUT_MS = DEFAULT_HARD_TIMEOUT_MS;
