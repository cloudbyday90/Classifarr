/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { tmdbService } from '../services/tmdb.mjs';
import { authenticateToken, requireAdmin } from '../middleware/auth.mjs';
import { createMediaIdentityReviewService } from '../services/mediaIdentityReviewService.mjs';
import { createMediaIdentityReviewRouter } from './mediaIdentityReviewRouter.mjs';

export const router = createMediaIdentityReviewRouter({
  authenticateToken, requireAdmin,
  service: createMediaIdentityReviewService({ db, getIdentityDetails: (id, type) => tmdbService.getIdentityDetails(id, type) }),
});
