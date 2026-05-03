/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const db = require('../config/database');
const tmdbService = require('./tmdb');
const discordBot = require('./discordBot');
const contentTypeAnalyzer = require('./contentTypeAnalyzer');
const clarificationService = require('./clarificationService');
const classificationPhaseService = require('./classificationPhaseService');
const classificationRetryService = require('./classificationRetryService');
const classificationEvidenceReinforcementService = require('./classificationEvidenceReinforcementService');
const classificationEvidenceService = require('./classificationEvidenceService');
const { createLogger } = require('../utils/logger');
const classificationMetadataService = require('./classificationMetadataService');
const classificationUtilsService = require('./classificationUtilsService');
const classificationRoutingService = require('./classificationRoutingService');
const libraryRulesService = require('./libraryRulesService');
const libraryLabelsService = require('./libraryLabelsService');
const classificationLearnedCorrectionsService = require('./classificationLearnedCorrectionsService');
const classificationAiService = require('./classificationAiService');
const classificationPersistenceService = require('./classificationPersistenceService');
const classificationRagLoopService = require('./classificationRagLoopService');
const mediaSyncService = require('./mediaSync');
const classificationPolicyPathService = require('./classificationPolicyPathService');
const classificationLegacySignalPathService = require('./classificationLegacySignalPathService');
const { normalizePolicyDecisionThresholds } = require('../utils/policyThresholds');
const idleDetector = require('../utils/idleDetector');
const { createClassificationService } = require('./classificationServiceCore.shared');
const { createClassificationRuntime } = require('./classification.shared');

module.exports = createClassificationRuntime({
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
