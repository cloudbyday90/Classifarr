/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { getEndpoint } from './cloudLLMHelpers.mjs';
import { healthConfigurationQuery } from './healthConfigurationQueries.mjs';
import { readHealthConfiguration, buildUnknownHealthState } from './healthConfigurationRead.mjs';
import { buildNotConfiguredHealthState, buildStatusHealthState } from './healthCheckServiceShared.mjs';
import { measureConnectionProbe, buildConnectionProbeHealthState, buildInvalidConnectionHealthState } from './healthConnectionProbe.mjs';
import { healthProbeUrl, readHealthProbeJson } from './healthProbeRequest.mjs';
import { resolveOllamaApplicationClient } from './ollamaApplicationScope.mjs';

const cloudProviders = new Set(['openai', 'openrouter', 'gemini', 'litellm', 'custom']);
const keyRequired = new Set(['openai', 'openrouter', 'gemini']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

export async function checkOllama(previous, guard = undefined) {
    try {
        const result = await readHealthConfiguration(previous, 'ollama', () => db.query(healthConfigurationQuery('ollama')), guard);
        if (!result.ok) return result.health;
        const config = result.rows[0];
        const provider = config?.primary_provider;
        if (!provider || provider === 'none') return buildNotConfiguredHealthState(previous, { provider: 'none' });

        if (cloudProviders.has(provider)) {
            const endpoint = getEndpoint(config);
            if (!nonempty(endpoint) || !nonempty(config.model) || (keyRequired.has(provider) && !nonempty(config.api_key))) {
                return buildNotConfiguredHealthState(previous, { provider,
                    error: 'Complete the provider, model and required connection settings in AI settings.' });
            }
            try { healthProbeUrl(endpoint, ''); } // Validate only: no paid/generation or cloud probe.
            catch { return buildInvalidConnectionHealthState(previous); }
            return buildStatusHealthState(previous, 'configured', { provider, responseTime: null });
        }
        if (provider !== 'ollama') return buildInvalidConnectionHealthState(previous, true);

        // SQL resolves legacy active configuration before AI settings, as getConfig does.
        // Do not use the singleton's cached endpoint for a fresh saved-settings check.
        const saved = config.ollama_config_id != null || config.ollama_host;
        const host = saved ? config.ollama_host : (process.env.OLLAMA_HOST || 'localhost');
        const port = saved ? (config.ollama_port || 11434) : (process.env.OLLAMA_PORT || 11434);
        let url;
        try {
            if (!nonempty(host)) throw new TypeError('Invalid Ollama host');
            const base = new URL(`http://${host}:${port}`);
            if (base.pathname !== '/') throw new TypeError('Invalid Ollama host');
            url = healthProbeUrl(base.href, '/api/tags');
        } catch { return buildInvalidConnectionHealthState(previous); }
        const probe = await measureConnectionProbe(async () => {
            const scoped = resolveOllamaApplicationClient({ baseUrl: new URL(url).origin, host, port });
            if (scoped) return { success: Array.isArray(await scoped.getModels()) };
            const data = await readHealthProbeJson(url);
            return Array.isArray(data?.models) ? { success: true } : null;
        });
        return buildConnectionProbeHealthState(previous, probe, { provider });
    } catch (_error) {
        return buildUnknownHealthState(previous, 'ollama');
    }
}
