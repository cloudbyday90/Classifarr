const db = require('../../config/database');
const policyEngine = require('../../services/policyEngine');

describe('PolicyEngine Integration Tests', () => {
    let testLibraryId;
    let testPolicyId;
    let testPresetId;
    let testMediaServerId;

    beforeAll(async () => {
        // Ensure test media server exists
        const serverRes = await db.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'Test Media Server', 'http://localhost:32400', 'test-api-key')
            ON CONFLICT DO NOTHING
            RETURNING id
        `);
        
        if (serverRes.rows.length > 0) {
            testMediaServerId = serverRes.rows[0].id;
        } else {
            const existingServer = await db.query(`
                SELECT id FROM media_server LIMIT 1
            `);
            testMediaServerId = existingServer.rows[0].id;
        }

        // Create test library
        const libRes = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
            VALUES ($1, 'test-policy-lib-' || gen_random_uuid()::text, 'Test Policy Library', 'movie', true)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libRes.rows[0].id;

        // Create test content preset
        const presetRes = await db.query(`
            INSERT INTO content_presets (key, name, signals, is_system)
            VALUES (
                'test_action_movies',
                'Test Action Movies',
                '{"genres": {"require_any": ["Action"], "weight": 1.5}, "vote_average": {"min": 6.0, "weight": 0.5}}'::jsonb,
                false
            )
            RETURNING id
        `);
        testPresetId = presetRes.rows[0].id;

        // Create test policy
        const policyRes = await db.query(`
            INSERT INTO library_policies (
                library_id,
                name,
                enabled,
                auto_classify_threshold,
                prompt_threshold,
                trust_patterns,
                trust_rag,
                trust_history,
                preset_weight,
                pattern_weight,
                rag_weight,
                history_weight
            ) VALUES ($1, 'Test Policy', true, 85, 60, true, true, true, 0.4, 0.3, 0.2, 0.1)
            RETURNING id
        `, [testLibraryId]);
        testPolicyId = policyRes.rows[0].id;

        // Link preset to policy
        await db.query(`
            INSERT INTO policy_presets (policy_id, preset_id, weight)
            VALUES ($1, $2, 1.0)
        `, [testPolicyId, testPresetId]);
    });

    afterAll(async () => {
        // Clean up test data
        if (testPolicyId) {
            await db.query('DELETE FROM library_policies WHERE id = $1', [testPolicyId]);
        }
        if (testPresetId) {
            await db.query('DELETE FROM content_presets WHERE id = $1', [testPresetId]);
        }
        if (testLibraryId) {
            await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
        }
    });

    describe('getActivePolicies', () => {
        test('should retrieve active policies with presets', async () => {
            const policies = await policyEngine.getActivePolicies();
            
            expect(Array.isArray(policies)).toBe(true);
            expect(policies.length).toBeGreaterThan(0);
            
            const testPolicy = policies.find(p => p.id === testPolicyId);
            expect(testPolicy).toBeDefined();
            expect(testPolicy.name).toBe('Test Policy');
            expect(testPolicy.library_id).toBe(testLibraryId);
            expect(testPolicy.enabled).toBe(true);
            expect(Array.isArray(testPolicy.presets)).toBe(true);
            expect(testPolicy.presets.length).toBeGreaterThan(0);
        });

        test('policy should have correct thresholds and weights', async () => {
            const policies = await policyEngine.getActivePolicies();
            const testPolicy = policies.find(p => p.id === testPolicyId);
            
            expect(testPolicy.auto_classify_threshold).toBe(85);
            expect(testPolicy.prompt_threshold).toBe(60);
            expect(testPolicy.preset_weight).toBe(0.4);
            expect(testPolicy.pattern_weight).toBe(0.3);
            expect(testPolicy.rag_weight).toBe(0.2);
            expect(testPolicy.history_weight).toBe(0.1);
        });
    });

    describe('checkAuthoritativeSignals', () => {
        test('should return null if no source_library_id', async () => {
            const item = {
                title: 'Test Movie',
                media_type: 'movie'
            };
            
            const result = await policyEngine.checkAuthoritativeSignals(item);
            expect(result).toBeNull();
        });

        test('should match source library if configured', async () => {
            // Update policy with source library ID
            await db.query(`
                UPDATE library_policies
                SET source_library_ids = '["test-source-lib-123"]'::jsonb
                WHERE id = $1
            `, [testPolicyId]);

            const item = {
                title: 'Test Movie',
                media_type: 'movie',
                source_library_id: 'test-source-lib-123'
            };
            
            const result = await policyEngine.checkAuthoritativeSignals(item);
            
            expect(result).not.toBeNull();
            expect(result.confidence).toBe(100);
            expect(result.method).toBe('authoritative_source_library');
            expect(result.library_id).toBe(testLibraryId);

            // Clean up
            await db.query(`
                UPDATE library_policies
                SET source_library_ids = '[]'::jsonb
                WHERE id = $1
            `, [testPolicyId]);
        });
    });

    describe('Signal Scoring Methods', () => {
        test('scoreCertification should handle include mode', () => {
            const config = {
                mode: 'include',
                include: ['PG', 'PG-13']
            };
            
            const item1 = { certification: 'PG' };
            const item2 = { certification: 'R' };
            
            expect(policyEngine.scoreCertification(config, item1)).toBe(100);
            expect(policyEngine.scoreCertification(config, item2)).toBe(0);
        });

        test('scoreCertification should handle exclude mode', () => {
            const config = {
                mode: 'exclude',
                exclude: ['R', 'NC-17']
            };
            
            const item1 = { certification: 'PG' };
            const item2 = { certification: 'R' };
            
            expect(policyEngine.scoreCertification(config, item1)).toBe(100);
            expect(policyEngine.scoreCertification(config, item2)).toBe(0);
        });

        test('scoreGenres should handle require_any', () => {
            const config = {
                require_any: ['Action', 'Thriller']
            };
            
            const item1 = { genres: ['Action', 'Comedy'] };
            const item2 = { genres: ['Comedy', 'Drama'] };
            
            expect(policyEngine.scoreGenres(config, item1)).toBeGreaterThan(0);
            expect(policyEngine.scoreGenres(config, item2)).toBe(0);
        });

        test('scoreGenres should handle exclude', () => {
            const config = {
                require_any: ['Action'],
                exclude: ['Horror']
            };
            
            const item1 = { genres: ['Action', 'Horror'] };
            
            expect(policyEngine.scoreGenres(config, item1)).toBe(0);
        });

        test('scoreKeywords should search in keywords and overview', () => {
            const config = {
                require_any: ['superhero']
            };
            
            const item1 = { keywords: ['superhero', 'marvel'], overview: '' };
            const item2 = { keywords: [], overview: 'A story about a superhero' };
            const item3 = { keywords: [], overview: 'A romantic comedy' };
            
            expect(policyEngine.scoreKeywords(config, item1)).toBeGreaterThan(0);
            expect(policyEngine.scoreKeywords(config, item2)).toBeGreaterThan(0);
            expect(policyEngine.scoreKeywords(config, item3)).toBe(0);
        });

        test('scoreReleaseYear should handle min/max', () => {
            const config = {
                min: 2000,
                max: 2020
            };
            
            const item1 = { year: 2010 };
            const item2 = { year: 1990 };
            const item3 = { year: 2025 };
            
            expect(policyEngine.scoreReleaseYear(config, item1)).toBe(100);
            expect(policyEngine.scoreReleaseYear(config, item2)).toBe(0);
            expect(policyEngine.scoreReleaseYear(config, item3)).toBe(0);
        });

        test('scoreVoteAverage should handle min threshold', () => {
            const config = {
                min: 7.0
            };
            
            const item1 = { rating: 8.5 };
            const item2 = { rating: 6.0 };
            
            expect(policyEngine.scoreVoteAverage(config, item1)).toBeGreaterThan(0);
            expect(policyEngine.scoreVoteAverage(config, item2)).toBe(0);
        });

        test('scoreRuntime should handle min/max minutes', () => {
            const config = {
                min_minutes: 90,
                max_minutes: 150
            };
            
            const item1 = { runtime: 120 };
            const item2 = { runtime: 60 };
            const item3 = { runtime: 180 };
            
            expect(policyEngine.scoreRuntime(config, item1)).toBe(100);
            expect(policyEngine.scoreRuntime(config, item2)).toBe(0);
            expect(policyEngine.scoreRuntime(config, item3)).toBe(0);
        });

        test('scoreLanguage should handle require_any and exclude', () => {
            const config1 = {
                require_any: ['en', 'es']
            };
            const config2 = {
                exclude: ['en']
            };
            
            const item = { original_language: 'en' };
            
            expect(policyEngine.scoreLanguage(config1, item)).toBeGreaterThan(0);
            expect(policyEngine.scoreLanguage(config2, item)).toBe(0);
        });

        test('scoreMediaType should match included types', () => {
            const config = {
                include: ['movie']
            };
            
            const item1 = { media_type: 'movie' };
            const item2 = { media_type: 'tv' };
            
            expect(policyEngine.scoreMediaType(config, item1)).toBe(100);
            expect(policyEngine.scoreMediaType(config, item2)).toBe(0);
        });
    });

    describe('evaluatePresetSignals', () => {
        test('should combine multiple signal types with weights', async () => {
            const signals = {
                genres: {
                    require_any: ['Action'],
                    weight: 1.5
                },
                vote_average: {
                    min: 6.0,
                    weight: 0.5
                }
            };
            
            const item = {
                genres: ['Action', 'Thriller'],
                rating: 7.5
            };
            
            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });

        test('should return 0 if media_type does not match', async () => {
            const signals = {
                media_type: {
                    include: ['tv']
                },
                genres: {
                    require_any: ['Action']
                }
            };
            
            const item = {
                media_type: 'movie',
                genres: ['Action']
            };
            
            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBe(0);
        });
    });

    describe('scorePresets', () => {
        test('should score item against presets', async () => {
            const presets = [
                {
                    signals: {
                        genres: {
                            require_any: ['Action']
                        }
                    },
                    weight: 1.0
                }
            ];
            
            const item = {
                genres: ['Action', 'Thriller']
            };
            
            const score = await policyEngine.scorePresets(presets, item);
            expect(score).toBeGreaterThan(0);
        });

        test('should return 0 for empty presets', async () => {
            const score = await policyEngine.scorePresets([], {});
            expect(score).toBe(0);
        });
    });

    describe('evaluatePolicy', () => {
        test('should evaluate policy with weighted scores', async () => {
            const policy = {
                id: testPolicyId,
                name: 'Test Policy',
                library_id: testLibraryId,
                library_name: 'Test Library',
                auto_classify_threshold: 85,
                prompt_threshold: 60,
                trust_patterns: false,
                trust_rag: false,
                trust_history: false,
                preset_weight: 1.0,
                pattern_weight: 0.0,
                rag_weight: 0.0,
                history_weight: 0.0,
                presets: [
                    {
                        signals: {
                            genres: {
                                require_any: ['Action']
                            }
                        },
                        weight: 1.0
                    }
                ]
            };
            
            const item = {
                genres: ['Action', 'Thriller']
            };
            
            const result = await policyEngine.evaluatePolicy(policy, item);
            
            expect(result).toBeDefined();
            expect(result.policy_id).toBe(testPolicyId);
            expect(result.score).toBeGreaterThan(0);
            expect(result.scores).toBeDefined();
            expect(result.weights).toBeDefined();
        });
    });

    describe('determineAction', () => {
        test('should auto-classify if score meets threshold', () => {
            const ranked = [
                {
                    policy_id: 1,
                    library_id: testLibraryId,
                    library_name: 'Test Library',
                    score: 90,
                    auto_classify_threshold: 85,
                    prompt_threshold: 60
                }
            ];
            
            const result = policyEngine.determineAction(ranked);
            
            expect(result.action).toBe('auto_classify');
            expect(result.confidence).toBe(90);
            expect(result.library).toBeDefined();
        });

        test('should prompt_confirm if score between prompt and auto threshold', () => {
            const ranked = [
                {
                    policy_id: 1,
                    library_id: testLibraryId,
                    library_name: 'Test Library',
                    score: 70,
                    auto_classify_threshold: 85,
                    prompt_threshold: 60
                }
            ];
            
            const result = policyEngine.determineAction(ranked);
            
            expect(result.action).toBe('prompt_confirm');
            expect(result.confidence).toBe(70);
        });

        test('should prompt_select if score below prompt threshold', () => {
            const ranked = [
                {
                    policy_id: 1,
                    library_id: testLibraryId,
                    library_name: 'Test Library',
                    score: 50,
                    auto_classify_threshold: 85,
                    prompt_threshold: 60
                }
            ];
            
            const result = policyEngine.determineAction(ranked);
            
            expect(result.action).toBe('prompt_select');
            expect(result.confidence).toBe(50);
        });

        test('should return manual if no rankings', () => {
            const result = policyEngine.determineAction([]);
            
            expect(result.action).toBe('manual');
            expect(result.confidence).toBe(0);
        });
    });

    describe('evaluateItem - End to End', () => {
        test('should evaluate item through full pipeline', async () => {
            const item = {
                title: 'Test Action Movie',
                media_type: 'movie',
                genres: ['Action', 'Thriller'],
                rating: 7.5,
                year: 2020,
                keywords: ['adventure', 'hero'],
                overview: 'An action-packed thriller'
            };
            
            const result = await policyEngine.evaluateItem(item);
            
            expect(result).toBeDefined();
            expect(result.action).toBeDefined();
            expect(['auto_classify', 'prompt_confirm', 'prompt_select', 'manual']).toContain(result.action);
            expect(result.confidence).toBeDefined();
            expect(result.ranked).toBeDefined();
            expect(Array.isArray(result.ranked)).toBe(true);
        });

        test('should handle authoritative match', async () => {
            // Update policy with source library
            await db.query(`
                UPDATE library_policies
                SET source_library_ids = '["test-auth-lib"]'::jsonb
                WHERE id = $1
            `, [testPolicyId]);

            const item = {
                title: 'Test Movie',
                media_type: 'movie',
                source_library_id: 'test-auth-lib',
                genres: ['Action']
            };
            
            const result = await policyEngine.evaluateItem(item);
            
            expect(result.action).toBe('auto_classify');
            expect(result.confidence).toBe(100);
            expect(result.method).toBe('authoritative_source_library');

            // Clean up
            await db.query(`
                UPDATE library_policies
                SET source_library_ids = '[]'::jsonb
                WHERE id = $1
            `, [testPolicyId]);
        });
    });

    describe('rankResults', () => {
        test('should sort evaluations by score descending', async () => {
            const evaluations = [
                { policy_id: 1, score: 50 },
                { policy_id: 2, score: 80 },
                { policy_id: 3, score: 65 }
            ];
            
            const ranked = await policyEngine.rankResults(evaluations);
            
            expect(ranked[0].score).toBe(80);
            expect(ranked[1].score).toBe(65);
            expect(ranked[2].score).toBe(50);
        });

        test('should filter out zero scores', async () => {
            const evaluations = [
                { policy_id: 1, score: 50 },
                { policy_id: 2, score: 0 },
                { policy_id: 3, score: 65 }
            ];
            
            const ranked = await policyEngine.rankResults(evaluations);
            
            expect(ranked.length).toBe(2);
            expect(ranked.find(r => r.score === 0)).toBeUndefined();
        });
    });
});
