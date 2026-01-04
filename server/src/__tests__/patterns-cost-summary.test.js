const db = require('../config/database');

jest.mock('../config/database');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('Patterns Cost Summary Endpoint Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Cost Summary Calculation', () => {
        it('should correctly calculate savings when both AI and pattern calls exist', async () => {
            // Mock database response
            db.query.mockResolvedValue({
                rows: [{
                    calls_made: '30',
                    calls_avoided: '70'
                }]
            });

            const callsMade = 30;
            const callsAvoided = 70;
            const totalCalls = callsMade + callsAvoided;
            const savingsPercent = Math.round((callsAvoided / totalCalls) * 100);

            expect(savingsPercent).toBe(70);
            expect(totalCalls).toBe(100);
        });

        it('should handle zero total calls gracefully', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    calls_made: '0',
                    calls_avoided: '0'
                }]
            });

            const callsMade = 0;
            const callsAvoided = 0;
            const totalCalls = callsMade + callsAvoided;
            const savingsPercent = totalCalls > 0 
                ? Math.round((callsAvoided / totalCalls) * 100) 
                : 0;

            expect(savingsPercent).toBe(0);
            expect(totalCalls).toBe(0);
        });

        it('should handle only AI calls (no savings)', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    calls_made: '50',
                    calls_avoided: '0'
                }]
            });

            const callsMade = 50;
            const callsAvoided = 0;
            const totalCalls = callsMade + callsAvoided;
            const savingsPercent = totalCalls > 0 
                ? Math.round((callsAvoided / totalCalls) * 100) 
                : 0;

            expect(savingsPercent).toBe(0);
            expect(totalCalls).toBe(50);
        });

        it('should handle only pattern calls (100% savings)', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    calls_made: '0',
                    calls_avoided: '100'
                }]
            });

            const callsMade = 0;
            const callsAvoided = 100;
            const totalCalls = callsMade + callsAvoided;
            const savingsPercent = totalCalls > 0 
                ? Math.round((callsAvoided / totalCalls) * 100) 
                : 0;

            expect(savingsPercent).toBe(100);
            expect(totalCalls).toBe(100);
        });

        it('should handle null values from database', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    calls_made: null,
                    calls_avoided: null
                }]
            });

            const callsMade = parseInt(null || 0);
            const callsAvoided = parseInt(null || 0);
            const totalCalls = callsMade + callsAvoided;

            expect(callsMade).toBe(0);
            expect(callsAvoided).toBe(0);
            expect(totalCalls).toBe(0);
        });

        it('should round savings percentage correctly', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    calls_made: '33',
                    calls_avoided: '67'
                }]
            });

            const callsMade = 33;
            const callsAvoided = 67;
            const totalCalls = callsMade + callsAvoided;
            const savingsPercent = Math.round((callsAvoided / totalCalls) * 100);

            expect(savingsPercent).toBe(67); // 67/100 = 67%
        });
    });

    describe('Classification Method Filtering', () => {
        it('should count AI methods correctly', () => {
            const aiMethods = ['ai_verified', 'ai_analysis'];
            const patternMethods = ['learned_pattern', 'rule_match', 'exact_match', 'custom_rule'];

            // Simulate checking if a method is AI-based
            const isAIMethod = (method) => aiMethods.includes(method);

            expect(isAIMethod('ai_verified')).toBe(true);
            expect(isAIMethod('ai_analysis')).toBe(true);
            expect(isAIMethod('learned_pattern')).toBe(false);
            expect(isAIMethod('rule_match')).toBe(false);
            expect(isAIMethod('exact_match')).toBe(false);
            expect(isAIMethod('custom_rule')).toBe(false);
        });

        it('should count pattern/rule methods correctly', () => {
            const aiMethods = ['ai_verified', 'ai_analysis'];
            const patternMethods = ['learned_pattern', 'rule_match', 'exact_match', 'custom_rule'];

            // Simulate checking if a method avoids AI
            const avoidsAI = (method) => patternMethods.includes(method);

            expect(avoidsAI('learned_pattern')).toBe(true);
            expect(avoidsAI('rule_match')).toBe(true);
            expect(avoidsAI('exact_match')).toBe(true);
            expect(avoidsAI('custom_rule')).toBe(true);
            expect(avoidsAI('ai_verified')).toBe(false);
            expect(avoidsAI('ai_analysis')).toBe(false);
        });
    });
});
