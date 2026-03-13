/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const promptBuilder = require('../services/promptBuilder');

describe('PromptBuilder Integration Tests', () => {
    describe('determinePromptType', () => {
        test('should identify low confidence prompt', () => {
            const evaluation = {
                action: 'prompt_select',
                confidence: 65,
                ranked: [
                    { library_id: 1, library_name: 'Action', score: 65 }
                ]
            };
            
            const type = promptBuilder.determinePromptType(evaluation);
            expect(type).toBe('low_confidence');
        });
        
        test('should identify close race prompt', () => {
            const evaluation = {
                action: 'prompt_select',
                confidence: 75,
                ranked: [
                    { library_id: 1, library_name: 'Action', score: 75 },
                    { library_id: 2, library_name: 'Thriller', score: 72 }
                ]
            };
            
            const type = promptBuilder.determinePromptType(evaluation);
            expect(type).toBe('close_race');
        });
        
        test('should identify AI rejection prompt', () => {
            const evaluation = {
                action: 'prompt_select',
                confidence: 80,
                ranked: [
                    { library_id: 1, library_name: 'Action', score: 80 }
                ],
                aiRejection: {
                    reasoning: 'Content does not match library guidelines'
                }
            };
            
            const type = promptBuilder.determinePromptType(evaluation);
            expect(type).toBe('ai_rejection');
        });
        
        test('should identify new discovery prompt', () => {
            const evaluation = {
                action: 'prompt_select',
                confidence: 70,
                ranked: [
                    { library_id: 1, library_name: 'Indie', score: 70 }
                ],
                newStudio: 'A24'
            };
            
            const type = promptBuilder.determinePromptType(evaluation);
            expect(type).toBe('new_discovery');
        });
        
        test('should identify confirmation prompt', () => {
            const evaluation = {
                action: 'prompt_confirm',
                confidence: 82,
                ranked: [
                    { library_id: 1, library_name: 'Action', score: 82 }
                ]
            };
            
            const type = promptBuilder.determinePromptType(evaluation);
            expect(type).toBe('confirmation');
        });
        
        test('should default to standard prompt', () => {
            const evaluation = {
                action: 'manual',
                confidence: 75,
                ranked: []
            };
            
            const type = promptBuilder.determinePromptType(evaluation);
            expect(type).toBe('standard');
        });
    });
    
    describe('buildLowConfidencePrompt', () => {
        test('should build low confidence prompt with signals', async () => {
            const item = {
                title: 'Coraline',
                year: 2009,
                genres: JSON.stringify(['Animation', 'Fantasy']),
                certification: 'PG',
                keywords: JSON.stringify(['horror', 'dark', 'family'])
            };
            
            const evaluation = {
                confidence: 62,
                ranked: [
                    { library_id: 1, library_name: 'Family Movies', score: 62, policy_id: 10 },
                    { library_id: 2, library_name: 'Animation', score: 58, policy_id: 11 },
                    { library_id: 3, library_name: 'Horror', score: 45, policy_id: 12 }
                ]
            };
            
            const prompt = promptBuilder.buildLowConfidencePrompt(item, evaluation);
            
            expect(prompt.type).toBe('low_confidence');
            expect(prompt.title).toContain('Coraline');
            expect(prompt.confidence).toBe(62);
            expect(prompt.topSuggestion).toBeDefined();
            expect(prompt.topSuggestion.libraryName).toBe('Family Movies');
            expect(prompt.suggestions).toHaveLength(3);
            expect(prompt.matchingSignals).toBeDefined();
            expect(prompt.reasonOptions).toBeDefined();
            expect(prompt.patternOptions).toBeDefined();
        });
    });
    
    describe('buildCloseRacePrompt', () => {
        test('should build close race prompt with key differences', async () => {
            const item = {
                title: 'Parasite',
                year: 2019,
                genres: JSON.stringify(['Thriller', 'Drama']),
                original_language: 'ko'
            };
            
            const evaluation = {
                confidence: 78,
                ranked: [
                    { 
                        library_id: 1, 
                        library_name: 'Foreign Films', 
                        score: 78,
                        policy_id: 10,
                        scores: { preset: 80, pattern: 70, rag: 75, history: 60 },
                        weights: { preset: 0.4, pattern: 0.3, rag: 0.2, history: 0.1 }
                    },
                    { 
                        library_id: 2, 
                        library_name: 'Thriller', 
                        score: 75,
                        policy_id: 11,
                        scores: { preset: 85, pattern: 65, rag: 70, history: 50 },
                        weights: { preset: 0.4, pattern: 0.3, rag: 0.2, history: 0.1 }
                    },
                    { 
                        library_id: 3, 
                        library_name: 'Drama', 
                        score: 72,
                        policy_id: 12,
                        scores: { preset: 75, pattern: 68, rag: 72, history: 65 },
                        weights: { preset: 0.4, pattern: 0.3, rag: 0.2, history: 0.1 }
                    }
                ]
            };
            
            const prompt = promptBuilder.buildCloseRacePrompt(item, evaluation);
            
            expect(prompt.type).toBe('close_race');
            expect(prompt.title).toContain('Parasite');
            expect(prompt.topContenders).toHaveLength(3);
            expect(prompt.topContenders[0].libraryName).toBe('Foreign Films');
            expect(prompt.topContenders[0].scoreBreakdown).toBeDefined();
            expect(prompt.keyDifferences).toBeDefined();
        });
    });
    
    describe('buildNewDiscoveryPrompt', () => {
        test('should build new discovery prompt for unknown studio', async () => {
            const item = {
                title: 'Everything Everywhere All at Once',
                year: 2022,
                studios: JSON.stringify(['A24']),
                genres: JSON.stringify(['Science Fiction', 'Comedy', 'Drama'])
            };
            
            const evaluation = {
                confidence: 72,
                newStudio: 'A24',
                ranked: [
                    { library_id: 1, library_name: 'Indie/Art House', score: 72, policy_id: 10 },
                    { library_id: 2, library_name: 'Sci-Fi', score: 65, policy_id: 11 },
                    { library_id: 3, library_name: 'Comedy', score: 60, policy_id: 12 }
                ]
            };
            
            const prompt = promptBuilder.buildNewDiscoveryPrompt(item, evaluation);
            
            expect(prompt.type).toBe('new_discovery');
            expect(prompt.discoveryType).toBe('studio');
            expect(prompt.discoveryEntity).toBe('A24');
            expect(prompt.bestGuess).toBeDefined();
            expect(prompt.bestGuess.libraryName).toBe('Indie/Art House');
            expect(prompt.suggestions).toHaveLength(3);
        });
        
        test('should build new discovery prompt for unknown collection', async () => {
            const item = {
                title: 'Fast X',
                year: 2023,
                belongs_to_collection: JSON.stringify({ name: 'Fast & Furious Collection' }),
                genres: JSON.stringify(['Action'])
            };
            
            const evaluation = {
                confidence: 75,
                newCollection: 'Fast & Furious Collection',
                ranked: [
                    { library_id: 1, library_name: 'Action', score: 75, policy_id: 10 }
                ]
            };
            
            const prompt = promptBuilder.buildNewDiscoveryPrompt(item, evaluation);
            
            expect(prompt.type).toBe('new_discovery');
            expect(prompt.discoveryType).toBe('collection');
            expect(prompt.discoveryEntity).toBe('Fast & Furious Collection');
        });
    });
    
    describe('buildConfirmationPrompt', () => {
        test('should build confirmation prompt with user choice', async () => {
            const item = {
                title: 'The Matrix',
                year: 1999,
                genres: JSON.stringify(['Science Fiction', 'Action'])
            };
            
            const evaluation = {
                action: 'prompt_confirm',
                confidence: 85,
                library: {
                    library_id: 1,
                    library_name: 'Sci-Fi Classics',
                    policy_id: 10
                },
                ranked: [
                    { library_id: 1, library_name: 'Sci-Fi Classics', score: 85, policy_id: 10, scores: { pattern: 80 } }
                ]
            };
            
            const userChoice = {
                libraryId: 1,
                libraryName: 'Sci-Fi Classics',
                reasons: ['genre_based'],
                patternActions: [
                    { type: 'remember_keyword', value: 'cyberpunk', targetLibraryId: 1 }
                ]
            };
            
            const prompt = promptBuilder.buildConfirmationPrompt(item, evaluation, userChoice);
            
            expect(prompt.type).toBe('confirmation');
            expect(prompt.suggestion).toBeDefined();
            expect(prompt.userChoice).toBeDefined();
            expect(prompt.userChoice.libraryId).toBe(1);
            expect(prompt.patternsCreated).toHaveLength(1);
            expect(prompt.futureImpact).toBeDefined();
        });
    });
    
    describe('buildBatchSummary', () => {
        test('should group items by prompt type', () => {
            const items = [
                {
                    id: 1,
                    title: 'High Conf Item',
                    evaluation: { confidence: 85, ranked: [] }
                },
                {
                    id: 2,
                    title: 'Low Conf Item',
                    evaluation: { confidence: 60, ranked: [] }
                },
                {
                    id: 3,
                    title: 'Close Race Item',
                    evaluation: {
                        confidence: 75,
                        ranked: [
                            { library_id: 1, score: 75 },
                            { library_id: 2, score: 72 }
                        ]
                    }
                },
                {
                    id: 4,
                    title: 'New Discovery Item',
                    evaluation: { confidence: 70, newStudio: 'TestStudio', ranked: [] }
                }
            ];
            
            const summary = promptBuilder.buildBatchSummary(items);
            
            expect(summary.type).toBe('batch_summary');
            expect(summary.totalItems).toBe(4);
            expect(summary.summary.highConfidence).toBe(1);
            expect(summary.summary.lowConfidence).toBe(1);
            expect(summary.summary.closeRace).toBe(1);
            expect(summary.summary.newDiscovery).toBe(1);
        });
    });
    
    describe('formatForDiscord', () => {
        test('should format low confidence prompt for Discord', () => {
            const prompt = {
                type: 'low_confidence',
                title: 'Test Movie (2023)',
                confidence: 65,
                topSuggestion: { libraryId: 1, libraryName: 'Action', score: 65 },
                matchingSignals: ['Action genre', 'PG-13 rating'],
                conflictingSignals: ['Dark themes detected'],
                missingSignals: ['Studio information'],
                suggestions: [
                    { libraryId: 1, libraryName: 'Action', score: 65 },
                    { libraryId: 2, libraryName: 'Drama', score: 60 }
                ]
            };
            
            const discord = promptBuilder.formatForDiscord(prompt);
            
            expect(discord.embeds).toBeDefined();
            expect(discord.embeds).toHaveLength(1);
            expect(discord.embeds[0].title).toContain('Test Movie');
            expect(discord.embeds[0].color).toBe(0xFFA500); // Orange for low confidence
            expect(discord.embeds[0].fields).toBeDefined();
            expect(discord.components).toBeDefined();
        });
    });
    
    describe('formatForWeb', () => {
        test('should format prompt for web UI', () => {
            const prompt = {
                type: 'standard',
                title: 'Test Movie (2023)',
                confidence: 75,
                suggestion: { libraryId: 1, libraryName: 'Action', score: 75 },
                suggestions: [
                    { libraryId: 1, libraryName: 'Action', score: 75 }
                ],
                reasonOptions: [],
                patternOptions: []
            };
            
            const web = promptBuilder.formatForWeb(prompt);
            
            expect(web.type).toBe('standard');
            expect(web.title).toBe('Test Movie (2023)');
            expect(web.content).toBeDefined();
            expect(web.actions).toBeDefined();
            expect(web.metadata).toBeDefined();
            expect(web.metadata.confidence).toBe(75);
        });
    });
    
    describe('buildReasonOptions', () => {
        test('should generate contextual reason options', () => {
            const item = {
                title: 'Test Movie',
                genres: JSON.stringify(['Action', 'Thriller']),
                studios: JSON.stringify(['Warner Bros']),
                certification: 'PG-13',
                keywords: JSON.stringify(['superhero', 'action']),
                belongs_to_collection: JSON.stringify({ name: 'Batman Collection' })
            };
            
            const evaluation = {
                ranked: []
            };
            
            const options = promptBuilder.buildReasonOptions(item, evaluation);
            
            expect(options.length).toBeGreaterThan(0);
            expect(options.some(o => o.category === 'genre')).toBe(true);
            expect(options.some(o => o.category === 'studio')).toBe(true);
            expect(options.some(o => o.category === 'rating')).toBe(true);
            expect(options.some(o => o.category === 'keywords')).toBe(true);
            expect(options.some(o => o.category === 'collection')).toBe(true);
            expect(options.some(o => o.category === 'custom')).toBe(true);
        });
    });
    
    describe('buildPatternOptions', () => {
        test('should generate pattern learning options', () => {
            const item = {
                title: 'Test Movie',
                studios: JSON.stringify(['Pixar']),
                belongs_to_collection: JSON.stringify({ name: 'Toy Story Collection' }),
                keywords: JSON.stringify(['animation', 'family'])
            };
            
            const evaluation = {
                ranked: []
            };
            
            const options = promptBuilder.buildPatternOptions(item, evaluation);
            
            expect(options.length).toBeGreaterThan(0);
            expect(options.some(o => o.type === 'studio')).toBe(true);
            expect(options.some(o => o.type === 'collection')).toBe(true);
            expect(options.some(o => o.type === 'keyword')).toBe(true);
        });
    });
    
    describe('buildTuningSuggestionPrompt', () => {
        test('should build tuning suggestion prompt with all fields', () => {
            const suggestion = {
                suggestion_type: 'adjust_weight',
                suggestion_config: {
                    signal_type: 'preset',
                    current_value: 0.4,
                    recommended_value: 0.5
                },
                confidence: 85,
                impact_estimate: 'medium',
                supporting_feedback_ids: [1, 2, 3],
                policy_id: 10,
                policy_name: 'Action Movies Policy',
                created_at: '2023-12-01T10:00:00Z'
            };
            
            const prompt = promptBuilder.buildTuningSuggestionPrompt(suggestion);
            
            expect(prompt.type).toBe('tuning_suggestion');
            expect(prompt.suggestionType).toBe('adjust_weight');
            expect(prompt.config).toEqual(suggestion.suggestion_config);
            expect(prompt.confidence).toBe(85);
            expect(prompt.impactEstimate).toBe('medium');
            expect(prompt.supportingEvidence).toEqual([1, 2, 3]);
            expect(prompt.policyId).toBe(10);
            expect(prompt.policyName).toBe('Action Movies Policy');
            expect(prompt.createdAt).toBe('2023-12-01T10:00:00Z');
        });
        
        test('should handle suggestion with minimal fields', () => {
            const suggestion = {
                suggestion_type: 'add_preset',
                suggestion_config: { preset_id: 5 },
                policy_id: 10
            };
            
            const prompt = promptBuilder.buildTuningSuggestionPrompt(suggestion);
            
            expect(prompt.type).toBe('tuning_suggestion');
            expect(prompt.suggestionType).toBe('add_preset');
            expect(prompt.supportingEvidence).toEqual([]);
        });
    });
});
