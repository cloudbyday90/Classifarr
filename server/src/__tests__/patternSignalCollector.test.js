const patternSignalCollector = require('../services/patternSignalCollector');
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

describe('PatternSignalCollector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('isEnabled', () => {
        it('should return true when pattern mining is enabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            const enabled = await patternSignalCollector.isEnabled();
            expect(enabled).toBe(true);
        });

        it('should return false when pattern mining is disabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: false
            });

            const enabled = await patternSignalCollector.isEnabled();
            expect(enabled).toBe(false);
        });

        it('should return false by default', async () => {
            embeddingRouter.getConfig.mockResolvedValue({});

            const enabled = await patternSignalCollector.isEnabled();
            expect(enabled).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            embeddingRouter.getConfig.mockRejectedValue(new Error('Config error'));

            const enabled = await patternSignalCollector.isEnabled();
            expect(enabled).toBe(false);
        });
    });

    describe('collectSignals', () => {
        it('should return empty array when disabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: false
            });

            const signals = await patternSignalCollector.collectSignals({
                studios: ['Warner Bros']
            });

            expect(signals).toEqual([]);
        });

        it('should return empty array when no metadata provided', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            const signals = await patternSignalCollector.collectSignals(null);

            expect(signals).toEqual([]);
        });

        it('should collect studio pattern signals', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    pattern_type: 'studio',
                    pattern_value: 'Warner Bros',
                    library_id: 1,
                    library_name: 'Movies',
                    confidence: 85,
                    sample_size: 10,
                    status: 'approved'
                }]
            });

            const signals = await patternSignalCollector.collectSignals({
                studios: ['Warner Bros']
            }, 50);

            expect(signals.length).toBe(1);
            expect(signals[0].type).toBe('pattern_studio');
            expect(signals[0].pattern_value).toBe('Warner Bros');
            expect(signals[0].confidence).toBe(85);
            expect(signals[0].library.id).toBe(1);
        });

        it('should collect genre pattern signals', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockResolvedValue({
                rows: [{
                    id: 2,
                    pattern_type: 'genre',
                    pattern_value: 'Action,Sci-Fi',
                    library_id: 1,
                    library_name: 'Movies',
                    confidence: 75,
                    sample_size: 5,
                    status: 'discovered'
                }]
            });

            const signals = await patternSignalCollector.collectSignals({
                genres: ['Sci-Fi', 'Action']
            }, 50);

            expect(signals.length).toBe(1);
            expect(signals[0].type).toBe('pattern_genre');
            expect(signals[0].confidence).toBe(75);
        });

        it('should sort signals by confidence descending', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            // Mock multiple pattern responses
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1, confidence: 60, pattern_type: 'studio', pattern_value: 'Studio A', library_id: 1, library_name: 'Movies', sample_size: 3, status: 'discovered' }] })
                .mockResolvedValueOnce({ rows: [{ id: 2, confidence: 90, pattern_type: 'genre', pattern_value: 'Action', library_id: 1, library_name: 'Movies', sample_size: 10, status: 'approved' }] })
                .mockResolvedValueOnce({ rows: [{ id: 3, confidence: 75, pattern_type: 'certification', pattern_value: 'PG-13', library_id: 1, library_name: 'Movies', sample_size: 7, status: 'discovered' }] });

            const signals = await patternSignalCollector.collectSignals({
                studios: ['Studio A'],
                genres: ['Action'],
                certification: 'PG-13'
            }, 50);

            expect(signals.length).toBe(3);
            expect(signals[0].confidence).toBe(90);
            expect(signals[1].confidence).toBe(75);
            expect(signals[2].confidence).toBe(60);
        });

        it('should filter out patterns below minimum confidence', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockResolvedValue({ rows: [] }); // No patterns meet threshold

            const signals = await patternSignalCollector.collectSignals({
                studios: ['Warner Bros']
            }, 90); // High threshold

            expect(signals).toEqual([]);
        });

        it('should handle database errors gracefully', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockRejectedValue(new Error('Database error'));

            const signals = await patternSignalCollector.collectSignals({
                studios: ['Warner Bros']
            });

            // Should return empty array on error
            expect(signals).toEqual([]);
        });
    });

    describe('getBestMatch', () => {
        it('should return highest confidence pattern', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1, confidence: 85, pattern_type: 'studio', pattern_value: 'Studio A', library_id: 1, library_name: 'Movies', sample_size: 5, status: 'approved' }] })
                .mockResolvedValueOnce({ rows: [{ id: 2, confidence: 70, pattern_type: 'genre', pattern_value: 'Action', library_id: 1, library_name: 'Movies', sample_size: 3, status: 'discovered' }] });

            const bestMatch = await patternSignalCollector.getBestMatch({
                studios: ['Studio A'],
                genres: ['Action']
            });

            expect(bestMatch).toBeDefined();
            expect(bestMatch.confidence).toBe(85);
            expect(bestMatch.type).toBe('pattern_studio');
        });

        it('should return null when no patterns found', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockResolvedValue({ rows: [] });

            const bestMatch = await patternSignalCollector.getBestMatch({
                studios: ['Unknown Studio']
            });

            expect(bestMatch).toBeNull();
        });
    });
});
