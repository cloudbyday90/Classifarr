/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const getMappings = jest.fn();
const getUnmappedLibraries = jest.fn();
const getAvailableArrInstances = jest.fn();
const getArrRootFolders = jest.fn();
const getLibraryMapping = jest.fn();
const saveMapping = jest.fn();
const deleteMapping = jest.fn();
const autoDetectMappings = jest.fn();
const linkArrToMediaServer = jest.fn();

jest.unstable_mockModule('../services/libraryMappingService.mjs', () => ({ libraryMappingService: {
    getMappings,
    getUnmappedLibraries,
    getAvailableArrInstances,
    getArrRootFolders,
    getLibraryMapping,
    saveMapping,
    deleteMapping,
    autoDetectMappings,
    linkArrToMediaServer,
  }, default: {
    getMappings,
    getUnmappedLibraries,
    getAvailableArrInstances,
    getArrRootFolders,
    getLibraryMapping,
    saveMapping,
    deleteMapping,
    autoDetectMappings,
    linkArrToMediaServer,
  }, }));

const { router: mappingsRouter } = await import('../routes/mappings.mjs');

describe('Mappings Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/mappings', mappingsRouter);
  });

  it('returns mappings for a media server', async () => {
    getMappings.mockResolvedValueOnce([{ libraryId: 1 }]);

    const res = await request(app).get('/mappings/42').expect(200);

    expect(getMappings).toHaveBeenCalledWith(42);
    expect(res.body).toEqual([{ libraryId: 1 }]);
  });

  it('returns unmapped libraries for a media server', async () => {
    getUnmappedLibraries.mockResolvedValueOnce([{ id: 3 }]);

    const res = await request(app).get('/mappings/42/unmapped').expect(200);

    expect(getUnmappedLibraries).toHaveBeenCalledWith(42);
    expect(res.body).toEqual([{ id: 3 }]);
  });

  it('returns arr instances for a media server', async () => {
    getAvailableArrInstances.mockResolvedValueOnce([{ id: 9 }]);

    const res = await request(app).get('/mappings/42/arr-instances').expect(200);

    expect(getAvailableArrInstances).toHaveBeenCalledWith(42);
    expect(res.body).toEqual([{ id: 9 }]);
  });

  it('returns root folders for an arr instance', async () => {
    getArrRootFolders.mockResolvedValueOnce([{ path: '/data/movies' }]);

    const res = await request(app).get('/mappings/root-folders/radarr/7').expect(200);

    expect(getArrRootFolders).toHaveBeenCalledWith('radarr', 7);
    expect(res.body).toEqual([{ path: '/data/movies' }]);
  });

  it('returns mapped false when a library mapping is missing', async () => {
    getLibraryMapping.mockResolvedValueOnce(null);

    const res = await request(app).get('/mappings/library/5').expect(200);

    expect(getLibraryMapping).toHaveBeenCalledWith(5);
    expect(res.body).toEqual({ mapped: false });
  });

  it('saves a mapping', async () => {
    saveMapping.mockResolvedValueOnce({ id: 1, libraryId: 5 });

    const res = await request(app)
      .post('/mappings')
      .send({ libraryId: 5, arrConfigId: 9 })
      .expect(200);

    expect(saveMapping).toHaveBeenCalledWith({ libraryId: 5, arrConfigId: 9 });
    expect(res.body).toEqual({ id: 1, libraryId: 5 });
  });

  it('deletes a library mapping', async () => {
    deleteMapping.mockResolvedValueOnce(true);

    const res = await request(app).delete('/mappings/library/12').expect(200);

    expect(deleteMapping).toHaveBeenCalledWith(12);
    expect(res.body).toEqual({ success: true });
  });

  it('auto-detects mappings for a media server', async () => {
    autoDetectMappings.mockResolvedValueOnce({ created: 2 });

    const res = await request(app).post('/mappings/42/auto-detect').expect(200);

    expect(autoDetectMappings).toHaveBeenCalledWith(42);
    expect(res.body).toEqual({ created: 2 });
  });

  it('links an arr instance to a media server', async () => {
    linkArrToMediaServer.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/mappings/link-arr')
      .send({ arrType: 'sonarr', arrConfigId: 4, mediaServerId: 8 })
      .expect(200);

    expect(linkArrToMediaServer).toHaveBeenCalledWith('sonarr', 4, 8);
    expect(res.body).toEqual({ success: true });
  });

  it('propagates service errors as 500 responses', async () => {
    getMappings.mockRejectedValueOnce(new Error('service failed'));

    const res = await request(app).get('/mappings/42').expect(500);

    expect(res.body).toEqual({ error: 'service failed' });
  });
});
