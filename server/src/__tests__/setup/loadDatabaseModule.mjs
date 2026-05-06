import { jest } from '@jest/globals';

function createMockPool(overrides = {}) {
    return {
        query: jest.fn(),
        on: jest.fn(),
        connect: jest.fn(),
        ...overrides,
    };
}

async function loadDatabaseModule(options = {}) {
    const {
        pool: poolOverrides = {},
        loggerModule,
    } = options;

    jest.resetModules();

    const pool = createMockPool(poolOverrides);
    const pgModule = {
        Pool: jest.fn().mockImplementation(() => pool),
    };

    jest.unstable_mockModule('pg', () => ({ ...pgModule, default: pgModule }));

    if (loggerModule) {
        jest.unstable_mockModule('../../utils/logger.mjs', () => ({ ...loggerModule, default: loggerModule }));
    }

    const db = await import('../../config/database.mjs');

    return { db, pool, pgModule };
}

export { createMockPool, loadDatabaseModule };
