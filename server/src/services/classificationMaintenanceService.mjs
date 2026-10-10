/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import { createStaleClassificationHandoffRepository } from './staleClassificationHandoffRepository.mjs';
import { createLogger } from '../utils/logger.mjs';

export class ClassificationMaintenanceService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.logger = deps.logger || createLogger('ClassificationMaintenanceService');
        this.handoffRepository = deps.handoffRepository || createStaleClassificationHandoffRepository(this.db);
    }

    async cleanupStaleAwaitingDecisions() {
        try {
            const rows = await this.handoffRepository.handoff();
            if (rows.length === 0) return;
            this.logger.info('Stale awaiting_decision cleanup: tasks admitted', { count: rows.length });
        } catch {
            this.logger.error('Stale awaiting_decision cleanup failed', {
                code: 'stale_classification_handoff_failed',
                recovery: 'No partial handoff is committed. Check database availability and retry on the next scheduled run.'
            });
        }
    }
}

export const classificationMaintenanceService = new ClassificationMaintenanceService();
