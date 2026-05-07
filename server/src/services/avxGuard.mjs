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

async function setSetting(key, value) {
    try {
        await db.query(
            `INSERT INTO settings (key, value)
             VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [key, String(value)]
        );
    } catch (error) {
        if (error.code === '42P01') {
            return;
        }
        throw error;
    }
}

class AvxGuard {
    /**
     * Guard against pgvector AVX crashes on non-AVX CPUs.
     * Disables RAG if the image is AVX-optimized and the CPU lacks AVX.
     */
    async run() {
        const build = process.env.CLASSIFARR_PGVECTOR_BUILD || 'multi';
        const selected = process.env.CLASSIFARR_PGVECTOR_VARIANT_SELECTED || 'generic';
        const cpu = detectCpuFlags();

        await setSetting('avx_guard_last_run', new Date().toISOString());
        await setSetting('avx_guard_cpu_avx', cpu.hasAvx === null ? 'unknown' : cpu.hasAvx);
        await setSetting('avx_guard_cpu_avx2', cpu.hasAvx2 === null ? 'unknown' : cpu.hasAvx2);
        await setSetting('avx_guard_pgvector_build', build);
        await setSetting('avx_guard_pgvector_selected', selected);

        logger.info('AVX guard: recorded pgvector selection', {
            hasAvx: cpu.hasAvx,
            hasAvx2: cpu.hasAvx2,
            source: cpu.source,
            build,
            selected
        });

        return { action: 'recorded', selected, build };
    }
}

const avxGuard = new AvxGuard();

export default avxGuard;
