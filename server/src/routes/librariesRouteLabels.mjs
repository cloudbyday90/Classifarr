/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';

export function registerLabelRoutes(router, { db, requireReadWrite }) {
    router.get('/:id/labels', asyncHandler(async (req, res) => {
        const { id } = req.params;

        const result = await db.query(
            `
        SELECT ll.id, ll.rule_type, lp.id as preset_id, lp.category, lp.name, lp.display_name, lp.description
        FROM library_labels ll
        JOIN label_presets lp ON ll.label_preset_id = lp.id
        WHERE ll.library_id = $1
        ORDER BY lp.category, lp.name
      `,
            [id]
        );

        res.json(result.rows);
    }));

    router.post('/:id/labels', requireReadWrite, asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { label_preset_id, rule_type } = req.body;

        const result = await db.query(
            `INSERT INTO library_labels (library_id, label_preset_id, rule_type)
           VALUES ($1, $2, $3)
           ON CONFLICT (library_id, label_preset_id)
           DO UPDATE SET rule_type = $3
           RETURNING *`,
            [id, label_preset_id, rule_type]
        );

        res.json(result.rows[0]);
    }));

    router.delete('/:id/labels/:labelId', requireReadWrite, asyncHandler(async (req, res) => {
        const { id, labelId } = req.params;

        await db.query('DELETE FROM library_labels WHERE library_id = $1 AND id = $2', [id, labelId]);

        res.json({ success: true });
    }));

    router.get('/label-presets/all', asyncHandler(async (req, res) => {
        const result = await db.query('SELECT * FROM label_presets ORDER BY category, name');
        res.json(result.rows);
    }));
}
