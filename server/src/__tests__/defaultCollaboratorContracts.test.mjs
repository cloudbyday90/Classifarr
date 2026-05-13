/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { idleBackfillService } from '../services/idleBackfillService.mjs';
import { mediaSyncService } from '../services/mediaSync.mjs';
import { startupService } from '../services/startupService.mjs';

function readPath(target, pathSegments) {
  return pathSegments.reduce((value, segment) => value?.[segment], target);
}

function expectMethodAtPath(target, pathSegments) {
  expect(typeof readPath(target, pathSegments)).toBe('function');
}

describe('default collaborator contracts', () => {
  test('mediaSyncService exposes the default media-server service resolver', () => {
    expectMethodAtPath(mediaSyncService, ['mediaServerServices', 'getMediaServerService']);
  });

  test('idleBackfillService exposes the default idle-detector methods', () => {
    expectMethodAtPath(idleBackfillService, ['idleDetector', 'setIdleThreshold']);
    expectMethodAtPath(idleBackfillService, ['idleDetector', 'isIdle']);
  });

  test('startupService exposes a runtime wiring validator built from real defaults', () => {
    expect(Array.isArray(startupService.runtimeWiringChecks)).toBe(true);
    expect(startupService.runtimeWiringChecks).toHaveLength(3);
    for (const check of startupService.runtimeWiringChecks) {
      expect(typeof check.validate).toBe('function');
      expect(typeof check.actual).toBe('function');
    }
  });
});