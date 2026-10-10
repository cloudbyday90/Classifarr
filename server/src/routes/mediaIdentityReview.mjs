/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { tmdbService } from '../services/tmdb.mjs';
import { authenticateToken, requireAdmin } from '../middleware/auth.mjs';
import { createMediaIdentityReviewService } from '../services/mediaIdentityReviewService.mjs';
import { createMediaIdentityReviewRouter } from './mediaIdentityReviewRouter.mjs';
import { createSourceScopeEvidenceService } from '../services/sourceScopeEvidenceService.mjs';
import { createScopeCatalogProviderFactory } from '../services/sourceScopeEvidenceProviders.mjs';
import { getMediaServerService } from '../services/mediaServers/index.mjs';
import { createSourceMappingApproval } from '../services/sourceMappingApproval.mjs';
import { createSourceMappingManagement } from '../services/sourceMappingManagement.mjs';

const scopeDependencies = { db, getMediaServerService,
  withLock: fn => db.withSessionAdvisoryLock(db.DB_ADVISORY_LOCKS.SOURCE_SCOPE_EVIDENCE_REVIEW, fn),
  createCatalogProvider: createScopeCatalogProviderFactory(tmdbService) };

export const router = createMediaIdentityReviewRouter({
  authenticateToken, requireAdmin,
  service: {
    ...createMediaIdentityReviewService({ db, getIdentityDetails: (id, type) => tmdbService.getIdentityDetails(id, type) }),
    inspectSourceScope: createSourceScopeEvidenceService(scopeDependencies),
    approveSourceScope: createSourceMappingApproval(scopeDependencies),
    ...createSourceMappingManagement(db),
  },
});
