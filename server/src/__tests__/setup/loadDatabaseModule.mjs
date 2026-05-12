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

    const pool = createMockPool(poolOverrides);
    const pgModule = {
        Pool: jest.fn().mockImplementation(() => pool),
    };

    const { createDatabaseModule } = await import('../../config/database.mjs');
    const db = createDatabaseModule({
        pgModule,
        loggerFactory: loggerModule?.createLogger,
    });

    return { db, pool, pgModule };
}

export { createMockPool, loadDatabaseModule };
