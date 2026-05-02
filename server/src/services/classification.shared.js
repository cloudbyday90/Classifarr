/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function createResolvedLoader(service) {
	return async () => service;
}

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

module.exports = {
	createClassificationRuntime,
};
