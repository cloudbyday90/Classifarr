/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for OMDb service
 */

const mockAxios = {
    get: jest.fn()
};
jest.mock('axios', () => mockAxios);

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));

const db = require('../config/database');
const omdbService = require('../services/omdb');

describe('OMDbService', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    describe('Cloudflare Error Handling', () => {
        it('should retry and return null on Cloudflare 523 errors', async () => {
            const today = new Date().toISOString().split('T')[0];
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    api_key: 'test-key',
                    last_reset_date: today,
                    requests_today: 0,
                    daily_limit: 1000
                }]
            });

            mockAxios.get.mockRejectedValue({
                response: { status: 523 },
                message: 'Request failed with status code 523'
            });

            const incrementSpy = jest.spyOn(omdbService, 'incrementUsageCounter');

            const result = await omdbService.getByTitle('The Goldbergs', 2013, 'series');

            expect(result).toBeNull();
            expect(mockAxios.get).toHaveBeenCalledTimes(2);
            expect(incrementSpy).not.toHaveBeenCalled();
        });

        it('should retry and return null on other Cloudflare errors (520, 521, 522)', async () => {
            const today = new Date().toISOString().split('T')[0];
            const cloudflareErrors = [520, 521, 522];

            for (const statusCode of cloudflareErrors) {
                jest.clearAllMocks();
                
                db.query.mockResolvedValue({
                    rows: [{
                        id: 1,
                        api_key: 'test-key',
                        last_reset_date: today,
                        requests_today: 0,
                        daily_limit: 1000
                    }]
                });

                mockAxios.get.mockRejectedValue({
                    response: { status: statusCode },
                    message: `Request failed with status code ${statusCode}`
                });

                const incrementSpy = jest.spyOn(omdbService, 'incrementUsageCounter');

                const result = await omdbService.getByTitle('Test Movie', 2020, 'movie');

                expect(result).toBeNull();
                expect(mockAxios.get).toHaveBeenCalledTimes(2);
                expect(incrementSpy).not.toHaveBeenCalled();
            }
        });
    });
});
