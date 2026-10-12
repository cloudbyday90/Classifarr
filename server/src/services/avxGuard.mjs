/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'node:fs';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { recordPgvectorSelection } from './pgvectorSelectionRecorder.mjs';

const logger = createLogger('AvxGuard');

function detectCpuFlags() {
    let cpuinfo = '';
    try {
        cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    } catch (_error) {
        return {
            hasAvx: null,
            hasAvx2: null,
            source: 'unavailable'
        };
    }

    return {
        hasAvx: /\bavx\b/.test(cpuinfo),
        hasAvx2: /\bavx2\b/.test(cpuinfo),
        source: 'procfs'
    };
}

class AvxGuard {
    /** Record startup observations only; binary selection belongs to the entrypoint. */
    async run() {
        const cpu = detectCpuFlags();
        const result = await recordPgvectorSelection({ db, environment: process.env, cpu });
        if (!result.report) return { action: result.action, selected: null, build: null };
        logger.info('AVX guard: recorded pgvector startup report', result.report);
        return { action: result.action, selected: result.report.selectedVariant, build: result.report.build };
    }
}

export const avxGuard = new AvxGuard();
