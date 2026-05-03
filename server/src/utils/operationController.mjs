/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import operationController from './operationController.js';

export const OperationController = operationController.OperationController;
export const createController = operationController.createController;
export const DEFAULT_TIMEOUT_MS = operationController.DEFAULT_TIMEOUT_MS;
export const DEFAULT_INITIAL_TIMEOUT_MS = operationController.DEFAULT_INITIAL_TIMEOUT_MS;
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = operationController.DEFAULT_HEARTBEAT_TIMEOUT_MS;
export const DEFAULT_HARD_TIMEOUT_MS = operationController.DEFAULT_HARD_TIMEOUT_MS;
export default operationController;
