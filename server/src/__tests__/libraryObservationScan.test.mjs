/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildLibraryObservationScan } from '../services/libraryObservationScan.mjs';
import { projectLibraryObservationPoints } from '../services/libraryObservationPointHistory.mjs';

const snapshot = extra => ({ observed_at:'2026-09-05T12:00:00Z', libraries:[{id:1,name:'PRIVATE'}], items:[],
    row_count:0, active_library_count:1, acquisition_configured:true, population_fingerprints:{1:'a'.repeat(64)},
    scan_context:{scan_started_at:'2026-09-05T11:00:00Z',inventory_revision:'9007199254740993',clock_revision:'9007199254740995'},
    ...extra });
test('preserves exact bigint revisions and excludes raw labels from the write payload', () => {
    const result=buildLibraryObservationScan(snapshot());
    expect(result.inventory_revision).toBe('9007199254740993');
    expect(result.clock_revision).toBe('9007199254740995');
    expect(result.population_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(() => buildLibraryObservationScan(snapshot({scan_context:null}))).toThrow('context unavailable');
});
test('accumulates bounded page counts and chains only population digests', () => {
    const base=snapshot();
    const first=buildLibraryObservationScan(base);
    const second=buildLibraryObservationScan({...base,has_more:true,scan_context:{...base.scan_context,
        previous:{inventory_rows:20000,identified_rows:18000,population_fingerprint:first.population_fingerprint}}});
    expect(second).toMatchObject({inventory_rows:20000,identified_rows:18000,scanned_rows:20000,
        inventory_lower_bound:20001,status:'in_progress'});
    expect(second.population_fingerprint).not.toBe(first.population_fingerprint);
});
const point = (minute, extra={}) => ({ libraryId:1,observedAt:`2026-09-05T12:${minute}:00Z`,measurementVersion:3,
    scanStartedAt:`2026-09-05T12:${minute}:00Z`,status:'available',populationFingerprint:'a',continuitySince:'same',
    acquisitionConfigured:true,inventoryRows:20001,supportedRows:20001,identifiedRows:20001,capturedRows:0,
    freshRows:0,keywordRows:0,languageRows:0,...extra });
test('compares complete scans across partial visits and keeps version changes distinct from population changes', () => {
    const points=projectLibraryObservationPoints([point('20',{capturedRows:1}),
        point('15',{status:'in_progress',populationFingerprint:null}),point('10'),point('05',{measurementVersion:2})]);
    expect(points[0]).toMatchObject({comparison:'comparable',elapsedMinutes:10,delta:{capturedRows:1}});
    expect(points[1]).toMatchObject({comparison:'in_progress',delta:null});
    expect(points[2]).toMatchObject({comparison:'measurement_changed',populationChanged:null,delta:null});
    expect(projectLibraryObservationPoints([point('20',{status:'invalidated'})])[0].comparison).toBe('invalidated');
});
