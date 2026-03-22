/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { QueueAdminService } = require('../services/queueAdminService');

describe('QueueAdminService', () => {
    let client;
    let db;
    let logger;
    let classificationService;
    let ragGraphExtractor;
    let adminService;

    beforeEach(() => {
        client = { query: jest.fn() };
        db = {
            withTransaction: jest.fn(async (fn) => fn(client)),
        };
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        classificationService = {
            routeToArr: jest.fn().mockResolvedValue({ attempted: true, routed: true }),
        };
        ragGraphExtractor = {
            extract: jest.fn().mockReturnValue({
                director_name: 'Director',
                primary_studio_name: 'Studio',
                genre_names: ['Sci-Fi'],
                cast_ids: [1],
                cast_names: ['Actor'],
            }),
        };
        adminService = new QueueAdminService({
            db,
            logger,
            classificationService,
            ragGraphExtractor,
        });
    });

    it('returns task_not_found when the queue row is missing', async () => {
        client.query.mockResolvedValueOnce({ rows: [] });

        await expect(adminService.manualClassifyTask(12, 7, 'admin')).resolves.toEqual({
            success: false,
            code: 'task_not_found',
        });
    });

    it('returns invalid_state when the queue row is not pending', async () => {
        client.query.mockResolvedValueOnce({
            rows: [{ id: 12, task_type: 'classification', status: 'processing', payload: {} }],
        });

        await expect(adminService.manualClassifyTask(12, 7, 'admin')).resolves.toEqual({
            success: false,
            code: 'invalid_state',
            currentStatus: 'processing',
        });
    });

    it('routes first, then writes history, completes the task, and stores learning patterns', async () => {
        client.query
            .mockResolvedValueOnce({
                rows: [{
                    id: 12,
                    task_type: 'classification',
                    status: 'pending',
                    payload: JSON.stringify({
                        media: { title: 'Hoppers', year: 2026, tmdb_id: 1327819, media_type: 'movie' },
                    }),
                }],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 7, name: 'Family', media_type: 'movie' }],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 6606 }],
            })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rowCount: 1 });

        const result = await adminService.manualClassifyTask(12, 7, 'admin-user');

        expect(result).toEqual({
            success: true,
            classificationId: 6606,
            libraryId: 7,
            libraryName: 'Family',
            message: 'Classified "Hoppers" to Family',
        });
        expect(classificationService.routeToArr).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Hoppers', tmdb_id: 1327819 }),
            expect.objectContaining({ id: 7, name: 'Family' })
        );
        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO learning_patterns'),
            expect.arrayContaining([1327819, 'movie', 7])
        );
    });

    it('does not write history or task state when routing fails', async () => {
        classificationService.routeToArr.mockRejectedValueOnce(new Error('routing failed'));
        client.query
            .mockResolvedValueOnce({
                rows: [{
                    id: 12,
                    task_type: 'classification',
                    status: 'pending',
                    payload: { media: { title: 'Hoppers', tmdb_id: 1327819, media_type: 'movie' } },
                }],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 7, name: 'Family', media_type: 'movie' }],
            });

        await expect(adminService.manualClassifyTask(12, 7, 'admin')).rejects.toThrow('routing failed');
        expect(client.query).not.toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO classification_history'),
            expect.anything()
        );
    });
});
