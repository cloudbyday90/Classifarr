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
 * evidenceDiagnosticsService.js
 *
 * Phase 6 — Layer 4 operator debug read model.
 *
 * Compares a classification_evidence row against:
 *   1. PolicyEngine history for the same item (classification_history)
 *   2. Related evidence (other rows for the same library)
 *   3. Evidence comparison data (legacy vs new table parity)
 *
 * This is read-only and diagnostic-only. It must never be on the hot
 * classification path. Errors are swallowed with logging.
 *
 * Exported for dependency injection in tests.
 */

const classificationEvidenceRepository = require('./classificationEvidenceRepository');
const evidenceDiagnosticsServiceShared = require('./evidenceDiagnosticsService.shared');

const { EvidenceDiagnosticsService, createEvidenceDiagnosticsService } = evidenceDiagnosticsServiceShared;

const evidenceDiagnosticsService = createEvidenceDiagnosticsService({
  repository: classificationEvidenceRepository,
});

module.exports = evidenceDiagnosticsService;
module.exports.EvidenceDiagnosticsService = EvidenceDiagnosticsService;
module.exports.createEvidenceDiagnosticsService = createEvidenceDiagnosticsService;
