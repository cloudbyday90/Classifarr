/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import {
    formatMediaItem as _formatMediaItem,
    formatLibraryProfile as _formatLibraryProfile,
    formatPolicySignals as _formatPolicySignals,
    formatRAGContext as _formatRAGContext,
    formatPatternSignals as _formatPatternSignals,
    formatInstructions as _formatInstructions,
    getSectionData as _getSectionData,
    parseArray as _parseArray
} from './aiPromptBuilderFormatters.mjs';

export class AIPromptBuilder {
    constructor(deps = {}) {
        this._logger = deps.logger || null;
        this._normalizeMetadataList = deps.normalizeMetadataList || null;
        this.signalFormatters = new Map();
        this.registerDefaultFormatters();
    }

    get logger() {
        if (!this._logger) {
            this._logger = createLogger('AIPromptBuilder');
        }
        return this._logger;
    }

    get normalizeMetadataList() {
        if (!this._normalizeMetadataList) {
            this._normalizeMetadataList = normalizeMetadataList;
        }
        return this._normalizeMetadataList;
    }

    registerDefaultFormatters() {
        this.register('media_item', (data) => this.formatMediaItem(data));
        this.register('library_profile', (data) => this.formatLibraryProfile(data));
        this.register('policy_engine', (data) => this.formatPolicySignals(data));
        this.register('rag', (data) => this.formatRAGContext(data));
        this.register('patterns', (data) => this.formatPatternSignals(data));
        this.register('instructions', (data) => this.formatInstructions(data));
    }

    register(type, formatter) {
        this.signalFormatters.set(type, formatter);
        this.logger.debug('Registered signal formatter', { type });
    }

    async buildPrompt(context, options = {}) {
        const sections = [];
        const mode = options.mode || 'classify';

        const sectionOrder = [
            'media_item',
            'library_profile',
            'policy_engine',
            'rag',
            'patterns',
            'instructions'
        ];

        for (const sectionType of sectionOrder) {
            const formatter = this.signalFormatters.get(sectionType);
            if (!formatter) {
                this.logger.warn('No formatter registered for section type', { sectionType });
                continue;
            }

            const sectionData = this.getSectionData(sectionType, context, mode);
            if (!sectionData) {
                this.logger.debug('No data available for section, skipping', { sectionType });
                continue;
            }

            const formatted = await formatter(sectionData);
            if (formatted) {
                sections.push(formatted);
            }
        }

        return sections.join('\n\n');
    }

    getSectionData(sectionType, context, mode) {
        return _getSectionData(sectionType, context, mode);
    }

    formatMediaItem(item) {
        return _formatMediaItem(item, { parseArrayFn: (v) => this.parseArray(v) });
    }

    formatLibraryProfile(data) {
        return _formatLibraryProfile(data);
    }

    formatPolicySignals(data) {
        return _formatPolicySignals(data);
    }

    formatRAGContext(data) {
        return _formatRAGContext(data);
    }

    formatPatternSignals(data) {
        return _formatPatternSignals(data);
    }

    formatInstructions(data) {
        return _formatInstructions(data);
    }

    parseArray(value) {
        return _parseArray(value, this.normalizeMetadataList);
    }
}

export const aiPromptBuilder = new AIPromptBuilder();
