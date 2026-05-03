/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Unified evidence service across legacy patterns and classification_evidence.
 */

import classificationEvidenceService from './classificationEvidenceService.shared.js';

export const ClassificationEvidenceService = classificationEvidenceService.ClassificationEvidenceService ?? classificationEvidenceService;
export default classificationEvidenceService;
