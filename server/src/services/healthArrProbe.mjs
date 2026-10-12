/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { healthProbeUrl, readHealthProbeJson } from './healthProbeRequest.mjs';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;

async function probeArr(config, appName, defaultPort) {
    let url;
    try {
        if (!nonempty(config.api_key)) throw new TypeError('Missing API key');
        const path = config.base_path || '';
        const normalizedPath = path && !path.startsWith('/') ? `/${path}` : path;
        const base = config.url || `${config.protocol || 'http'}://${config.host || 'localhost'}:${config.port || defaultPort}${normalizedPath}`;
        url = healthProbeUrl(base, '/api/v3/system/status');
    } catch {
        return { success: false, code: 'configuration_invalid' };
    }
    const data = await readHealthProbeJson(url, { 'X-Api-Key': config.api_key }, {
        timeout: Number(config.timeout) * 1000,
        rejectUnauthorized: config.verify_ssl !== false,
    });
    // Older status objects may omit appName. Do not accept a different named app.
    const identity = data?.appName == null
        ? typeof data?.isProduction === 'boolean' : data.appName === appName;
    return nonempty(data?.version) && data.version.length <= 128 && identity
        ? { success: true } : null;
}

export const probeRadarrConnection = config => probeArr(config, 'Radarr', 7878);
export const probeSonarrConnection = config => probeArr(config, 'Sonarr', 8989);
