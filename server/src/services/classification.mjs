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
import * as policyThresholds from '../utils/policyThresholds.mjs';
import { idleDetector } from '../utils/idleDetector.mjs';
import { tmdbService } from './tmdb.mjs';
import { discordBotService as discordBot } from './discordBot.mjs';
import { contentTypeAnalyzer } from './contentTypeAnalyzer.mjs';
import { clarificationService } from './clarificationService.mjs';
import { classificationProgressStageService } from './classificationProgressStageService.mjs';
import { classificationRetryService } from './classificationRetryService.mjs';
import { classificationEvidenceReinforcementService } from './classificationEvidenceReinforcementService.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { classificationMetadataService } from './classificationMetadataService.mjs';
import { classificationUtilsService } from './classificationUtilsService.mjs';
import { classificationRoutingService } from './classificationRoutingService.mjs';
import { libraryRulesService } from './libraryRulesService.mjs';
import { libraryLabelsService } from './libraryLabelsService.mjs';
import { classificationLearnedCorrectionsService } from './classificationLearnedCorrectionsService.mjs';
import { classificationAiService } from './classificationAiService.mjs';
import { classificationPersistenceService } from './classificationPersistenceService.mjs';
import { classificationRagLoopService } from './classificationRagLoopService.mjs';
import { classificationAuthoritativeSignalService } from './classificationAuthoritativeSignalService.mjs';
import { classificationPolicyPathService } from './classificationPolicyPathService.mjs';
import { classificationLegacySignalPathService } from './classificationLegacySignalPathService.mjs';
import { createClassificationService } from './classificationServiceCore.mjs';

const { normalizePolicyDecisionThresholds } = policyThresholds;

export const classificationService = createClassificationService({
	infrastructure: {
		db,
		tmdbService,
		discordBot,
		contentTypeAnalyzer,
		clarificationService,
	},
	workflowServices: {
		classificationProgressStageService,
		classificationRetryService,
		classificationEvidenceReinforcementService,
		classificationEvidenceService,
	},
	domainServices: {
		classificationMetadataService,
		classificationUtilsService,
		classificationRoutingService,
		libraryRulesService,
		libraryLabelsService,
		classificationLearnedCorrectionsService,
		classificationAiService,
		classificationPersistenceService,
		classificationRagLoopService,
	classificationAuthoritativeSignalService,
	},
	utilities: {
		createLogger,
		normalizePolicyDecisionThresholds,
	},
	runtimeServices: {
		idleDetector,
		classificationPolicyPathService,
		classificationLegacySignalPathService,
	},
});
