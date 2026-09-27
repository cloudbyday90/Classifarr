/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { authenticateToken, requireAdmin } from '../middleware/auth.mjs';
import { createInventoryRecoveryReadService } from '../services/inventoryRecoveryReadService.mjs';
import { createInventoryRecoveryRouter } from './inventoryRecoveryRouter.mjs';

export const router = createInventoryRecoveryRouter({ authenticateToken, requireAdmin,
    service: createInventoryRecoveryReadService({ db }) });
