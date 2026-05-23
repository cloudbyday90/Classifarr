/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerConfigRoutes } from './patternsRouteConfig.mjs';
import { registerBrowsingRoutes } from './patternsRouteBrowsing.mjs';
import { registerActionRoutes } from './patternsRouteActions.mjs';

export function createPatternsRouter({
    express,
    db,
    logger,
    patternMiningService,
    patternReinforcementService,
    embeddingRouter,
}) {
const router = express.Router();

registerConfigRoutes(router, { db, embeddingRouter, logger });
registerBrowsingRoutes(router, { db, patternReinforcementService });
registerActionRoutes(router, { db, patternMiningService, patternReinforcementService, logger });

return router;
}
