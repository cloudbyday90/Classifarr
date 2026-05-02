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

/**
 * classificationEvidenceRepository.js
 *
 * All SQL for the classification_evidence table. This is the only place
 * that may issue DML against classification_evidence.
 *
 * Phase 3 role: receives dual-write fan-out from classificationEvidenceService.
 * Phase 4 role: will also serve as the authoritative read path.
 *
 * Conflict handling uses two partial unique indexes:
 *   item_exact  — (scope, tmdb_id, media_type) WHERE scope = 'item_exact' AND tmdb_id IS NOT NULL
 *   related     — (scope, media_type, library_id, evidence_key)
 *                 WHERE scope IN ('genre','studio','franchise','certification')
 *
 * On conflict, usage_count is incremented and confidence/evidence_data may be
 * updated according to the caller's conflictMode preference.
 */

const classificationEvidenceRepositoryShared = require('./classificationEvidenceRepository.shared');

const { ClassificationEvidenceRepository, createClassificationEvidenceRepository } = classificationEvidenceRepositoryShared;

const classificationEvidenceRepository = createClassificationEvidenceRepository();

module.exports = classificationEvidenceRepository;
module.exports.ClassificationEvidenceRepository = ClassificationEvidenceRepository;
module.exports.createClassificationEvidenceRepository = createClassificationEvidenceRepository;
