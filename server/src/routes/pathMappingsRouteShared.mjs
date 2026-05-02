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

export function createPathMappingsRouter({ express, fs, db, logger }) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      const result = await db.query(`
        SELECT * FROM path_mappings
        ORDER BY created_at DESC
      `);
      return res.json(result.rows);
    } catch (error) {
      logger.error('Failed to get path mappings', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { arr_path, local_path } = req.body;

      if (!arr_path || !local_path) {
        return res.status(400).json({ error: 'Both arr_path and local_path are required' });
      }

      const normalizedArrPath = arr_path.replace(/\/+$/, '');
      const normalizedLocalPath = local_path.replace(/\/+$/, '');

      const result = await db.query(
        `
          INSERT INTO path_mappings (arr_path, local_path, is_active)
          VALUES ($1, $2, true)
          RETURNING *
        `,
        [normalizedArrPath, normalizedLocalPath]
      );

      logger.info('Created path mapping', {
        arr_path: normalizedArrPath,
        local_path: normalizedLocalPath,
      });
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create path mapping', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { arr_path, local_path, is_active } = req.body;

      const normalizedArrPath = arr_path?.replace(/\/+$/, '');
      const normalizedLocalPath = local_path?.replace(/\/+$/, '');

      const result = await db.query(
        `
          UPDATE path_mappings
          SET arr_path = COALESCE($2, arr_path),
              local_path = COALESCE($3, local_path),
              is_active = COALESCE($4, is_active),
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [id, normalizedArrPath, normalizedLocalPath, is_active]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Path mapping not found' });
      }

      logger.info('Updated path mapping', { id });
      return res.json(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update path mapping', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query('DELETE FROM path_mappings WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Path mapping not found' });
      }

      logger.info('Deleted path mapping', { id });
      return res.json({ message: 'Path mapping deleted', deleted: result.rows[0] });
    } catch (error) {
      logger.error('Failed to delete path mapping', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/verify', async (req, res) => {
    try {
      const { id } = req.params;

      const mappingResult = await db.query('SELECT * FROM path_mappings WHERE id = $1', [id]);
      if (mappingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Path mapping not found' });
      }

      const mapping = mappingResult.rows[0];

      try {
        const stats = await fs.stat(mapping.local_path);
        const isDirectory = stats.isDirectory();

        if (!isDirectory) {
          return res.json({
            success: false,
            verified: false,
            error: 'Path exists but is not a directory',
          });
        }

        await db.query(
          `
            UPDATE path_mappings
            SET verified = true, last_verified_at = NOW(), updated_at = NOW()
            WHERE id = $1
          `,
          [id]
        );

        logger.info('Path mapping verified successfully', {
          id,
          local_path: mapping.local_path,
        });
        return res.json({
          success: true,
          verified: true,
          message: `Path "${mapping.local_path}" is accessible`,
          isDirectory: true,
        });
      } catch (fsError) {
        await db.query(
          `
            UPDATE path_mappings
            SET verified = false, last_verified_at = NOW(), updated_at = NOW()
            WHERE id = $1
          `,
          [id]
        );

        logger.warn('Path mapping verification failed', {
          id,
          local_path: mapping.local_path,
          error: fsError.message,
        });
        return res.json({
          success: false,
          verified: false,
          error: `Path is not accessible: ${fsError.message}`,
        });
      }
    } catch (error) {
      logger.error('Failed to verify path mapping', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/verify-all', async (_req, res) => {
    try {
      const mappings = await db.query('SELECT * FROM path_mappings WHERE is_active = true');
      const results = [];

      for (const mapping of mappings.rows) {
        try {
          const stats = await fs.stat(mapping.local_path);
          const isAccessible = stats.isDirectory();

          await db.query(
            `
              UPDATE path_mappings
              SET verified = $2, last_verified_at = NOW(), updated_at = NOW()
              WHERE id = $1
            `,
            [mapping.id, isAccessible]
          );

          results.push({
            id: mapping.id,
            arr_path: mapping.arr_path,
            local_path: mapping.local_path,
            verified: isAccessible,
          });
        } catch (fsError) {
          await db.query(
            `
              UPDATE path_mappings
              SET verified = false, last_verified_at = NOW(), updated_at = NOW()
              WHERE id = $1
            `,
            [mapping.id]
          );

          results.push({
            id: mapping.id,
            arr_path: mapping.arr_path,
            local_path: mapping.local_path,
            verified: false,
            error: fsError.message,
          });
        }
      }

      const allVerified = results.every(result => result.verified);
      logger.info('Verified all path mappings', { total: results.length, allVerified });

      return res.json({
        success: allVerified,
        results,
        summary: {
          total: results.length,
          verified: results.filter(result => result.verified).length,
          failed: results.filter(result => !result.verified).length,
        },
      });
    } catch (error) {
      logger.error('Failed to verify path mappings', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
