/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const { createConsoleSpy } = require('../setup/consoleHelpers');

createConsoleSpy('log', { suppress: true });
createConsoleSpy('info', { suppress: true });
createConsoleSpy('warn', { suppress: true });
createConsoleSpy('error', { suppress: true });
createConsoleSpy('debug', { suppress: true });