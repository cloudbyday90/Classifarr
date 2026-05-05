/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import db from '../config/database.mjs';
import loggerModule from '../utils/logger.mjs';
import policyThresholds from '../utils/policyThresholds.mjs';
import idleDetector from '../utils/idleDetector.mjs';
import tmdbService from './tmdb.mjs';
import discordBot from './discordBot.mjs';
import contentTypeAnalyzer from './contentTypeAnalyzer.mjs';
import clarificationService from './clarificationService.mjs';
import classificationPhaseService from './classificationPhaseService.mjs';
import classificationRetryService from './classificationRetryService.mjs';
import classificationEvidenceReinforcementService from './classificationEvidenceReinforcementService.mjs';
import classificationEvidenceService from './classificationEvidenceService.mjs';
import classificationMetadataService from './classificationMetadataService.mjs';
import classificationUtilsService from './classificationUtilsService.mjs';
import classificationRoutingService from './classificationRoutingService.mjs';
import { checkLibraryRules } from './libraryRulesService.mjs';
import { evaluateCustomRule, evaluateSingleCondition, matchRules, metadataMatchesLabel } from './libraryLabelsService.mjs';
import { checkLearnedCorrections } from './classificationLearnedCorrectionsService.mjs';
import classificationAiService from './classificationAiService.mjs';
import classificationPersistenceService from './classificationPersistenceService.mjs';
import classificationRagLoopService from './classificationRagLoopService.mjs';
import mediaSyncService from './mediaSync.mjs';
import { execute as executeClassificationPolicyPath } from './classificationPolicyPathService.mjs';
import { execute as executeClassificationLegacySignalPath } from './classificationLegacySignalPathService.mjs';
import { createClassificationService } from './classificationServiceCore.mjs';
import { createResolvedLoader } from './shared/resolvedLoader.mjs';

const { createLogger } = loggerModule;
const { normalizePolicyDecisionThresholds } = policyThresholds;
const classificationPolicyPathService = { execute: executeClassificationPolicyPath };
const classificationLegacySignalPathService = { execute: executeClassificationLegacySignalPath };
const libraryRulesService = { checkLibraryRules };
const libraryLabelsService = { matchRules, metadataMatchesLabel, evaluateCustomRule, evaluateSingleCondition };
const classificationLearnedCorrectionsService = { checkLearnedCorrections };

function createClassificationRuntime({
	db,
	tmdbService,
	discordBot,
	contentTypeAnalyzer,
	clarificationService,
	classificationPhaseService,
	classificationRetryService,
	classificationEvidenceReinforcementService,
	classificationEvidenceService,
	classificationMetadataService,
	classificationUtilsService,
	classificationRoutingService,
	libraryRulesService,
	libraryLabelsService,
	classificationLearnedCorrectionsService,
	classificationAiService,
	classificationPersistenceService,
	classificationRagLoopService,
	createLogger,
	normalizePolicyDecisionThresholds,
	idleDetector,
	mediaSyncService,
	classificationPolicyPathService,
	classificationLegacySignalPathService,
	createClassificationService,
}) {
	return createClassificationService({
		db,
		tmdbService,
		discordBot,
		contentTypeAnalyzer,
		clarificationService,
		classificationPhaseService,
		classificationRetryService,
		classificationEvidenceReinforcementService,
		classificationEvidenceService,
		classificationMetadataService,
		classificationUtilsService,
		classificationRoutingService,
		libraryRulesService,
		libraryLabelsService,
		classificationLearnedCorrectionsService,
		classificationAiService,
		classificationPersistenceService,
		classificationRagLoopService,
		createLogger,
		normalizePolicyDecisionThresholds,
		loadIdleDetector: createResolvedLoader(idleDetector),
		loadMediaSyncService: createResolvedLoader(mediaSyncService),
		loadClassificationPolicyPathService: createResolvedLoader(classificationPolicyPathService),
		loadClassificationLegacySignalPathService: createResolvedLoader(classificationLegacySignalPathService),
	});
}

const classificationService = createClassificationRuntime({
  db,
  tmdbService,
  discordBot,
  contentTypeAnalyzer,
  clarificationService,
  classificationPhaseService,
  classificationRetryService,
  classificationEvidenceReinforcementService,
  classificationEvidenceService,
  classificationMetadataService,
  classificationUtilsService,
  classificationRoutingService,
  libraryRulesService,
  libraryLabelsService,
  classificationLearnedCorrectionsService,
  classificationAiService,
  classificationPersistenceService,
  classificationRagLoopService,
  createLogger,
  normalizePolicyDecisionThresholds,
  idleDetector,
  mediaSyncService,
  classificationPolicyPathService,
  classificationLegacySignalPathService,
  createClassificationService,
});

export default classificationService;
