/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import classificationAiService from './classificationAiService.shared.js';

export const normalizeAiResponseLine = classificationAiService.normalizeAiResponseLine;
export const buildAiRepairPrompt = classificationAiService.buildAiRepairPrompt;
export const attemptAiResponseRepair = classificationAiService.attemptAiResponseRepair;
export const aiClassify = classificationAiService.aiClassify;
export default classificationAiService;
