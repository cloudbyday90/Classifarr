import { jest } from '@jest/globals';
import { createDatabaseModule } from '../../config/database.mjs';

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

    const db = createDatabaseModule({
        pgModule,
        loggerFactory: loggerModule?.createLogger,
    });

    return { db, pool, pgModule };
}

export { createMockPool, loadDatabaseModule };
