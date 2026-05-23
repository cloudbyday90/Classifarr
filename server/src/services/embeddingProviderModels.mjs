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

import { cloudLLMService } from './cloudLLM.mjs';
import { PROVIDER_DEFAULTS } from './embeddingProviderConfig.mjs';

export async function getEmbeddingModels({ provider, api_key, api_endpoint } = {}) {
    const normalizedProvider = (provider || '').toLowerCase();
    if (!normalizedProvider) {
        return [];
    }

    switch (normalizedProvider) {
        case 'openai':
        case 'openrouter':
        case 'litellm':
        case 'custom':
            return await cloudLLMService.getEmbeddingModels({
                primary_provider: normalizedProvider,
                api_endpoint,
                api_key
            });
        case 'gemini':
            return await cloudLLMService.getEmbeddingModels({
                primary_provider: 'gemini',
                api_key
            });
        case 'voyage':
        case 'cohere': {
            const defaults = PROVIDER_DEFAULTS[normalizedProvider]?.models || [];
            return defaults.map(id => ({ id, name: id }));
        }
        default:
            return [];
    }
}
