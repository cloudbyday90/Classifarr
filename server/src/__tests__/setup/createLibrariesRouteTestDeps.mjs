import { jest } from '@jest/globals';

function createTestLogger() {
    return {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    };
}

export function createLibrariesRouteTestDeps(overrides = {}) {
    return {
        radarrService: {},
        sonarrService: {},
        ollamaService: {},
        mediaPatternAnalyzer: {},
        libraryProfileService: {},
        mediaSyncService: {},
        createLogger: () => createTestLogger(),
        normalizeMetadataListLower: (value) => value,
        authenticateTokenOrApiKey: (req, res, next) => next(),
        requireReadWrite: (req, res, next) => next(),
        metadataEnrichment: {},
        errors: {},
        ...overrides,
    };
}