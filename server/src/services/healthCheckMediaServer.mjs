/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { healthConfigurationQuery } from './healthConfigurationQueries.mjs';
import { readHealthConfiguration, buildUnknownHealthState } from './healthConfigurationRead.mjs';
import { buildNotConfiguredHealthState } from './healthCheckServiceShared.mjs';
import { measureConnectionProbe, buildConnectionProbeHealthState, buildInvalidConnectionHealthState } from './healthConnectionProbe.mjs';
import { healthProbeUrl, readHealthProbeJson } from './healthProbeRequest.mjs';

const serverTypes = new Set(['plex', 'emby', 'jellyfin']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

export async function checkMediaServer(previous, guard = undefined) {
    try {
        const result = await readHealthConfiguration(previous, 'mediaServer', () => db.query(healthConfigurationQuery('mediaServer')), guard);
        if (!result.ok) return result.health;
        const server = result.rows[0];
        if (!server) return buildNotConfiguredHealthState(previous, { type: null });
        if (!serverTypes.has(server.type)) return buildInvalidConnectionHealthState(previous, true);
        const identity = { type: server.type, name: server.name };
        if (!nonempty(server.url) || !nonempty(server.api_key)) {
            return buildNotConfiguredHealthState(previous, { ...identity,
                error: 'Complete the URL and API key in Media Server settings.' });
        }
        const plex = server.type === 'plex';
        let url;
        try { url = healthProbeUrl(server.url, plex ? '/' : '/System/Info'); }
        catch { return buildInvalidConnectionHealthState(previous); }
        const headers = plex ? {
            'X-Plex-Token': server.api_key,
            'X-Plex-Product': 'Classifarr',
            'X-Plex-Client-Identifier': server.client_identifier || 'classifarr',
        } : { 'X-Emby-Token': server.api_key };
        const probe = await measureConnectionProbe(async () => {
            const data = await readHealthProbeJson(url, headers);
            const valid = plex
                ? nonempty(data?.MediaContainer?.machineIdentifier) && nonempty(data?.MediaContainer?.version)
                : nonempty(data?.Id) && nonempty(data?.Version);
            return valid ? { success: true } : null;
        });
        return buildConnectionProbeHealthState(previous, probe, identity);
    } catch (_error) {
        return buildUnknownHealthState(previous, 'mediaServer');
    }
}
