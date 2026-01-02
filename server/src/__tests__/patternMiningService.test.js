const patternMiningService = require('../services/patternMiningService');
const embeddingRouter = require('../services/embeddingRouter');
const db = require('../config/database');

jest.mock('../services/embeddingRouter');
jest.mock('../config/database');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));
jest.mock('../utils/ragLogger', () => ({
    logOperation: jest.fn(),
    logError: jest.fn()
}));

describe('PatternMiningService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('isEnabled', () => {
        it('should return true when pattern mining is enabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            const enabled = await patternMiningService.isEnabled();
            expect(enabled).toBe(true);
        });

        it('should return false when pattern mining is disabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: false
            });

            const enabled = await patternMiningService.isEnabled();
            expect(enabled).toBe(false);
        });

        it('should return false by default (opt-in)', async () => {
            embeddingRouter.getConfig.mockResolvedValue({});

            const enabled = await patternMiningService.isEnabled();
            expect(enabled).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            embeddingRouter.getConfig.mockRejectedValue(new Error('Config error'));

            const enabled = await patternMiningService.isEnabled();
            expect(enabled).toBe(false);
        });
    });

    describe('discoverPatterns', () => {
        it('should not run when disabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: false
            });

            const result = await patternMiningService.discoverPatterns();
            
            expect(result.discovered).toBe(0);
            expect(result.message).toContain('disabled');
        });

        it('should discover patterns when enabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            // Mock individual discovery methods
            jest.spyOn(patternMiningService, 'discoverStudioPatterns')
                .mockResolvedValue({ discovered: 5 });
            jest.spyOn(patternMiningService, 'discoverFranchisePatterns')
                .mockResolvedValue({ discovered: 3 });
            jest.spyOn(patternMiningService, 'discoverGenrePatterns')
                .mockResolvedValue({ discovered: 10 });
            jest.spyOn(patternMiningService, 'discoverCertificationPatterns')
                .mockResolvedValue({ discovered: 2 });

            const result = await patternMiningService.discoverPatterns();

            expect(result.discovered).toBe(20); // 5 + 3 + 10 + 2
            expect(result.results.studio.discovered).toBe(5);
            expect(result.results.franchise.discovered).toBe(3);
        });
    });

    describe('upsertPattern', () => {
        it('should insert new pattern', async () => {
            db.query.mockResolvedValue({
                rows: [{ id: 1, confidence: 85.5 }]
            });

            const result = await patternMiningService.upsertPattern(
                'studio',
                'Marvel Studios',
                1,
                'Movies',
                85.5,
                20
            );

            expect(result.id).toBe(1);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO discovered_patterns'),
                expect.arrayContaining(['studio', 'Marvel Studios', 1, 'Movies', 85.5, 20])
            );
        });

        it('should auto-approve high-confidence patterns (>= 85%)', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{ id: 1, confidence: 90.0 }]
                })
                .mockResolvedValueOnce({ rows: [] }); // For auto-approve

            jest.spyOn(patternMiningService, 'autoApprovePattern').mockResolvedValue();

            await patternMiningService.upsertPattern(
                'studio',
                'Warner Bros',
                1,
                'Movies',
                90.0,
                30
            );

            expect(patternMiningService.autoApprovePattern).toHaveBeenCalledWith(1);
        });

        it('should not auto-approve lower-confidence patterns', async () => {
            db.query.mockResolvedValue({
                rows: [{ id: 2, confidence: 75.0 }]
            });

            jest.spyOn(patternMiningService, 'autoApprovePattern').mockResolvedValue();

            await patternMiningService.upsertPattern(
                'genre',
                'Action',
                1,
                'Movies',
                75.0,
                15
            );

            expect(patternMiningService.autoApprovePattern).not.toHaveBeenCalled();
        });
    });

    describe('decayStalePatterns', () => {
        it('should decay patterns not seen in 90 days', async () => {
            db.query.mockResolvedValue({ rowCount: 5 });

            const count = await patternMiningService.decayStalePatterns(90);

            expect(count).toBe(5);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("last_seen_at < NOW() - INTERVAL '90 days'"),
                []
            );
        });

        it('should handle custom decay period', async () => {
            db.query.mockResolvedValue({ rowCount: 3 });

            const count = await patternMiningService.decayStalePatterns(60);

            expect(count).toBe(3);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("last_seen_at < NOW() - INTERVAL '60 days'"),
                []
            );
        });
    });

    describe('getActivePatterns', () => {
        it('should get all active patterns', async () => {
            db.query.mockResolvedValue({
                rows: [
                    { id: 1, pattern_type: 'studio', status: 'approved' },
                    { id: 2, pattern_type: 'genre', status: 'approved' }
                ]
            });

            const patterns = await patternMiningService.getActivePatterns();

            expect(patterns).toHaveLength(2);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("WHERE status = 'approved'"),
                []
            );
        });

        it('should filter by library ID', async () => {
            db.query.mockResolvedValue({
                rows: [
                    { id: 1, pattern_type: 'studio', library_id: 5 }
                ]
            });

            const patterns = await patternMiningService.getActivePatterns(5);

            expect(patterns).toHaveLength(1);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('AND library_id = $1'),
                [5]
            );
        });
    });

    describe('getPatternsSummary', () => {
        it('should return summary of patterns by type and status', async () => {
            db.query.mockResolvedValue({
                rows: [
                    { pattern_type: 'studio', status: 'approved', count: '10', avg_confidence: '85.5' },
                    { pattern_type: 'studio', status: 'discovered', count: '5', avg_confidence: '72.3' },
                    { pattern_type: 'genre', status: 'approved', count: '20', avg_confidence: '90.2' }
                ]
            });

            const summary = await patternMiningService.getPatternsSummary();

            expect(summary).toHaveLength(3);
            expect(summary[0].patternType).toBe('studio');
            expect(summary[0].count).toBe(10);
            expect(summary[0].avgConfidence).toBeCloseTo(85.5, 1);
        });

        it('should handle errors gracefully', async () => {
            db.query.mockRejectedValue(new Error('DB error'));

            const summary = await patternMiningService.getPatternsSummary();

            expect(summary).toEqual([]);
        });
    });

    describe('Discovery Methods', () => {
        it('should handle JSON parsing for studio names', async () => {
            db.query.mockResolvedValue({
                rows: [
                    { 
                        studio: '{"name":"Warner Bros","id":123}',
                        library_id: 1,
                        library_name: 'Movies',
                        support_count: '10',
                        confidence: '85.0'
                    }
                ]
            });

            jest.spyOn(patternMiningService, 'upsertPattern').mockResolvedValue({});

            await patternMiningService.discoverStudioPatterns();

            expect(patternMiningService.upsertPattern).toHaveBeenCalledWith(
                'studio',
                'Warner Bros',
                expect.any(Number),
                expect.any(String),
                expect.any(Number),
                expect.any(Number)
            );
        });

        it('should handle string studio names', async () => {
            db.query.mockResolvedValue({
                rows: [
                    {
                        studio: 'Universal Pictures',
                        library_id: 1,
                        library_name: 'Movies',
                        support_count: '8',
                        confidence: '80.0'
                    }
                ]
            });

            jest.spyOn(patternMiningService, 'upsertPattern').mockResolvedValue({});

            await patternMiningService.discoverStudioPatterns();

            expect(patternMiningService.upsertPattern).toHaveBeenCalledWith(
                'studio',
                'Universal Pictures',
                expect.any(Number),
                expect.any(String),
                expect.any(Number),
                expect.any(Number)
            );
        });
    });
});
