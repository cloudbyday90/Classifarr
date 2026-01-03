const patternReinforcementService = require('../services/patternReinforcementService');
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

describe('PatternReinforcementService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('isEnabled', () => {
        it('should return true when pattern mining is enabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            const enabled = await patternReinforcementService.isEnabled();
            expect(enabled).toBe(true);
        });

        it('should return false when disabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: false
            });

            const enabled = await patternReinforcementService.isEnabled();
            expect(enabled).toBe(false);
        });
    });

    describe('reinforceOnAccept', () => {
        it('should skip when disabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: false
            });

            await patternReinforcementService.reinforceOnAccept(1, [], 1);

            expect(db.query).not.toHaveBeenCalled();
        });

        it('should skip when no pattern signals', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            await patternReinforcementService.reinforceOnAccept(1, [], 1);

            expect(db.query).not.toHaveBeenCalled();
        });

        it('should boost confidence when pattern suggested correct library', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockResolvedValue({ rows: [] });

            const patternSignals = [{
                pattern_id: 1,
                pattern_value: 'Warner Bros',
                confidence: 80,
                library: { id: 1, name: 'Movies' }
            }];

            await patternReinforcementService.reinforceOnAccept(1, patternSignals, 1);

            // Should log match and boost confidence
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO pattern_match_log'),
                expect.arrayContaining([1, 1, 'Warner Bros', 80, true, true])
            );

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE discovered_patterns'),
                expect.arrayContaining([95, 5, 1])
            );
        });

        it('should decay confidence when pattern suggested wrong library', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockResolvedValue({ rows: [] });

            const patternSignals = [{
                pattern_id: 1,
                pattern_value: 'Warner Bros',
                confidence: 80,
                library: { id: 1, name: 'Movies' }
            }];

            await patternReinforcementService.reinforceOnAccept(1, patternSignals, 2); // Different library

            // Should log match as incorrect and decay confidence
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO pattern_match_log'),
                expect.arrayContaining([1, 1, 'Warner Bros', 80, true, false])
            );

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE discovered_patterns'),
                expect.arrayContaining([5, 1])
            );
        });
    });

    describe('reinforceOnCorrection', () => {
        it('should decay confidence when pattern was wrong', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockResolvedValue({ rows: [{ confidence: 45 }] });

            const patternSignals = [{
                pattern_id: 1,
                pattern_value: 'Studio X',
                confidence: 50,
                library: { id: 1, name: 'Movies' }
            }];

            await patternReinforcementService.reinforceOnCorrection(1, patternSignals, 2);

            // Should log and decay
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO pattern_match_log'),
                expect.arrayContaining([1, 1, 'Studio X', 50, false, false])
            );

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE discovered_patterns'),
                expect.arrayContaining([5, 1])
            );
        });

        it('should boost confidence when pattern was actually correct', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockResolvedValue({ rows: [] });

            const patternSignals = [{
                pattern_id: 1,
                pattern_value: 'Studio X',
                confidence: 50,
                library: { id: 1, name: 'Movies' }
            }];

            // Corrected to same library as pattern suggested
            await patternReinforcementService.reinforceOnCorrection(1, patternSignals, 1);

            // Should log and boost
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO pattern_match_log'),
                expect.arrayContaining([1, 1, 'Studio X', 50, false, true])
            );
        });
    });

    describe('boostConfidence', () => {
        it('should increase confidence by 5%', async () => {
            db.query.mockResolvedValue({ rows: [] });

            await patternReinforcementService.boostConfidence(1);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE discovered_patterns'),
                expect.arrayContaining([95, 5, 1])
            );
        });

        it('should cap confidence at 95%', async () => {
            db.query.mockResolvedValue({ rows: [] });

            await patternReinforcementService.boostConfidence(1);

            // Check LEAST(95, confidence + 5) is used
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('LEAST'),
                expect.arrayContaining([95, 5, 1])
            );
        });
    });

    describe('decayConfidence', () => {
        it('should decrease confidence by 5%', async () => {
            db.query.mockResolvedValue({ 
                rows: [{ confidence: 60, pattern_type: 'studio', pattern_value: 'Studio X' }] 
            });

            await patternReinforcementService.decayConfidence(1);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE discovered_patterns'),
                expect.arrayContaining([5, 1])
            );
        });

        it('should auto-deprecate when below 30%', async () => {
            db.query
                .mockResolvedValueOnce({ 
                    rows: [{ confidence: 25, pattern_type: 'studio', pattern_value: 'Studio X' }] 
                })
                .mockResolvedValueOnce({ rows: [] });

            await patternReinforcementService.decayConfidence(1);

            // Should call deprecate
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("status = 'decayed'"),
                expect.arrayContaining([1])
            );
        });

        it('should not deprecate when above minimum', async () => {
            db.query.mockResolvedValue({ 
                rows: [{ confidence: 50, pattern_type: 'studio', pattern_value: 'Studio X' }] 
            });

            await patternReinforcementService.decayConfidence(1);

            // Should not call deprecate (only 1 query for decay)
            expect(db.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('resolveConflicts', () => {
        it('should keep highest confidence pattern', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query
                .mockResolvedValueOnce({
                    rows: [{
                        pattern_type: 'studio',
                        pattern_value: 'Warner Bros',
                        conflict_count: 2,
                        pattern_ids: [1, 2],
                        confidences: [85, 70],
                        library_names: ['Movies', 'Action Movies']
                    }]
                })
                .mockResolvedValueOnce({ rows: [] });

            const result = await patternReinforcementService.resolveConflicts();

            expect(result.resolved).toBe(1);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("status = 'decayed'"),
                expect.arrayContaining([[2]]) // Deprecate pattern 2
            );
        });

        it('should return 0 when no conflicts', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: true
            });

            db.query.mockResolvedValue({ rows: [] });

            const result = await patternReinforcementService.resolveConflicts();

            expect(result.resolved).toBe(0);
        });

        it('should skip when disabled', async () => {
            embeddingRouter.getConfig.mockResolvedValue({
                pattern_mining_enabled: false
            });

            const result = await patternReinforcementService.resolveConflicts();

            expect(result.resolved).toBe(0);
        });
    });

    describe('getPatternAccuracy', () => {
        it('should return accuracy statistics', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    total_uses: 10,
                    times_used: 8,
                    correct_predictions: 7,
                    incorrect_predictions: 3,
                    accuracy_percentage: 70.00
                }]
            });

            const accuracy = await patternReinforcementService.getPatternAccuracy(1);

            expect(accuracy.total_uses).toBe(10);
            expect(accuracy.correct_predictions).toBe(7);
            expect(accuracy.accuracy_percentage).toBe(70.00);
        });

        it('should return zeros when no data', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const accuracy = await patternReinforcementService.getPatternAccuracy(1);

            expect(accuracy.total_uses).toBe(0);
            expect(accuracy.accuracy_percentage).toBe(0);
        });

        it('should handle errors gracefully', async () => {
            db.query.mockRejectedValue(new Error('Column not found'));

            const accuracy = await patternReinforcementService.getPatternAccuracy(1);

            expect(accuracy.total_uses).toBe(0);
        });
    });
});
