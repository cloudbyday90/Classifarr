/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import logger from './logger.shared.js';

export const createLogger = logger.createLogger;
export const setLoggerDb = logger.setLoggerDb;
export const Logger = logger.Logger;
export const sanitizeData = logger.sanitizeData;
export const getSystemContext = logger.getSystemContext;
export const getRequestContext = logger.getRequestContext;
export const cleanupOldLogs = logger.cleanupOldLogs;
export const initializeFileLogging = logger.initializeFileLogging;
export default logger;
