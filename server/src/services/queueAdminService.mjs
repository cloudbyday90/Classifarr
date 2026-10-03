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
import { classificationService as defaultClassificationService } from './classification.mjs';
import * as ragGraphExtractor from './ragGraphExtractor.mjs';
import { parsePayload as sharedParsePayload } from '../utils/queueHelpers.mjs';
import { saveManualClassification } from './queueManualClassificationRecord.mjs';
import { captureManualRoutingIntent } from './manualRoutingIntentPersistence.mjs';
import { normalizeManualRoutingOutcome, recordManualRoutingOutcome, MANUAL_ROUTING_MESSAGE } from './queueManualRoutingOutcome.mjs';

export class QueueAdminService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.logger = deps.logger;
        this.classificationService = deps.classificationService || defaultClassificationService;
        this.ragGraphExtractor = deps.ragGraphExtractor || ragGraphExtractor;
    }

    async manualClassifyTask(taskId, libraryId, resolvedBy = 'admin') {
        const selection = await this.db.withTransaction(client => saveManualClassification(client, {
            taskId, libraryId, resolvedBy, parsePayload: value => this.parsePayload(value),
            extract: value => this.ragGraphExtractor.extract(value),
        }));
        if (!selection.success) return selection;

        let observed;
        try {
            observed = await this.classificationService.routeToArr(selection.metadata, selection.library, {
                beforeReconcile: input => captureManualRoutingIntent(this.db, selection, input),
            });
        } catch {
            observed = { attempted: true };
        }
        let routing = normalizeManualRoutingOutcome(observed);
        let recorded = false;
        try {
            recorded = await recordManualRoutingOutcome(this.db, selection, routing);
        } catch {
            // The committed unconfirmed marker survives. Never replay the provider write.
        }
        if (!recorded) {
            routing = normalizeManualRoutingOutcome({ attempted: routing.attempted, arrType: routing.arrType });
        }

        this.logger?.[routing.routed ? 'info' : 'warn']?.('Manual classification routing outcome', {
            taskId, classificationId: selection.classificationId, libraryId,
            routed: routing.routed, reason: routing.reason, recorded,
        });
        return {
            success: true, classificationId: selection.classificationId, libraryId, libraryName: selection.library.name,
            routing: { ...routing, recorded },
            message: routing.routed ? 'Selection saved and routing confirmed.' : MANUAL_ROUTING_MESSAGE,
        };
    }

    parsePayload(payload) { return sharedParsePayload(payload); }
}
