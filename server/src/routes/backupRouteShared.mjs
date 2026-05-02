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

export function isInvalidFilename(filename) {
  return !filename || filename.includes('..') || filename.includes('/') || filename.includes('\\');
}

export function createBackupRouter({
  express,
  pathModule,
  backupService,
  authenticateToken,
  requireAdmin,
  logger,
}) {
  const router = express.Router();

  router.use(authenticateToken);
  router.use(requireAdmin);

  router.post('/export', async (req, res) => {
    try {
      const {
        encrypted = true,
        password,
        includePatterns = true,
      } = req.body;

      if (encrypted && !backupService.isValidEncryptedBackupPassword(password)) {
        return res.status(400).json({
          error: backupService.ENCRYPTED_BACKUP_PASSWORD_ERROR,
        });
      }

      const result = await backupService.createBackup({
        encrypted,
        password,
        includePatterns,
      });

      await backupService.logAudit(
        'export',
        encrypted ? 'encrypted' : 'plaintext',
        result.filename,
        'success',
        {
          userId: req.user?.id,
          ipAddress: req.ip,
          fileSize: result.size,
          metadata: { includePatterns },
        }
      );

      logger.info('Backup created', {
        filename: result.filename,
        encrypted,
        user: req.user?.username,
      });

      return res.json({
        success: true,
        filename: result.filename,
        size: result.size,
        encrypted,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logger.error('Export failed', { error: error.message });

      await backupService.logAudit(
        'export',
        req.body.encrypted ? 'encrypted' : 'plaintext',
        'failed',
        'failed',
        {
          userId: req.user?.id,
          ipAddress: req.ip,
          error: error.message,
        }
      );

      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/import', async (req, res) => {
    try {
      const {
        filename,
        password,
        mode = 'replace',
      } = req.body;

      if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
      }

      if (isInvalidFilename(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const result = await backupService.restoreBackup(filename, {
        password,
        mode,
        userId: req.user?.id,
      });

      await backupService.logAudit(
        'import',
        filename.endsWith('.enc.json') ? 'encrypted' : 'plaintext',
        filename,
        'success',
        {
          userId: req.user?.id,
          ipAddress: req.ip,
          metadata: { mode, stats: result.stats },
        }
      );

      logger.info('Backup restored', {
        filename,
        mode,
        user: req.user?.username,
        stats: result.stats,
      });

      return res.json({
        success: true,
        newApiKey: result.newApiKey,
        stats: result.stats,
      });
    } catch (error) {
      logger.error('Import failed', { error: error.message });

      await backupService.logAudit(
        'import',
        req.body.filename?.endsWith('.enc.json') ? 'encrypted' : 'plaintext',
        req.body.filename || 'unknown',
        'failed',
        {
          userId: req.user?.id,
          ipAddress: req.ip,
          error: error.message,
        }
      );

      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/list', async (_req, res) => {
    try {
      const backups = await backupService.listBackups();
      return res.json({ backups });
    } catch (error) {
      logger.error('Failed to list backups', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/download/:filename', async (req, res) => {
    try {
      const { filename } = req.params;

      if (isInvalidFilename(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const backups = await backupService.listBackups();
      const backup = backups.find((entry) => entry.filename === filename);

      if (!backup) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      const backupDir = process.env.BACKUP_DIR || '/app/data/backups';
      const filepath = pathModule.join(backupDir, filename);

      return res.download(filepath, filename, async (error) => {
        if (error) {
          logger.error('Download failed', { filename, error: error.message });

          try {
            await backupService.logAudit(
              'download',
              backup.type,
              filename,
              'failed',
              {
                userId: req.user?.id,
                ipAddress: req.ip,
                fileSize: backup.size,
                error: error.message,
              }
            );
          } catch (auditError) {
            logger.error('Failed to log download audit (failure)', {
              filename,
              error: auditError.message,
            });
          }

          if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed' });
          }
          return;
        }

        try {
          await backupService.logAudit(
            'download',
            backup.type,
            filename,
            'success',
            {
              userId: req.user?.id,
              ipAddress: req.ip,
              fileSize: backup.size,
            }
          );
        } catch (auditError) {
          logger.error('Failed to log download audit (success)', {
            filename,
            error: auditError.message,
          });
        }
      });
    } catch (error) {
      logger.error('Download failed', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/preview', async (req, res) => {
    try {
      const { filename, password } = req.body;

      if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
      }

      if (isInvalidFilename(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const backupData = await backupService.readBackup(filename, password);

      const preview = {
        version: backupData.version,
        exportedAt: backupData.exportedAt,
        meta: backupData.meta,
        itemCounts: {
          users: backupData.data.users?.length || 0,
          mediaServers: backupData.data.mediaServers?.length || 0,
          libraries: backupData.data.libraries?.length || 0,
          policies: backupData.data.libraryPolicies?.length || 0,
          customRules: backupData.data.libraryCustomRules?.length || 0,
          labelPresets: backupData.data.labelPresets?.length || 0,
          scheduledTasks: backupData.data.scheduledTasks?.length || 0,
          learningPatterns: backupData.data.learningPatterns?.length || 0,
          autoLearnedPreferences: backupData.data.autoLearnedPreferences?.length || 0,
          classificationEvidence: backupData.data.classificationEvidence?.length || 0,
        },
        evidenceCategories: (() => {
          const rows = backupData.data.classificationEvidence ?? [];
          const byScope = {};
          const byProvenance = {};
          for (const row of rows) {
            byScope[row.scope] = (byScope[row.scope] ?? 0) + 1;
            byProvenance[row.provenance] = (byProvenance[row.provenance] ?? 0) + 1;
          }
          return { byScope, byProvenance, total: rows.length };
        })(),
      };

      return res.json(preview);
    } catch (error) {
      logger.error('Preview failed', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:filename', async (req, res) => {
    try {
      const { filename } = req.params;

      if (isInvalidFilename(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const backups = await backupService.listBackups();
      const backup = backups.find((entry) => entry.filename === filename);

      if (!backup) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      await backupService.deleteBackup(filename);

      await backupService.logAudit(
        'delete',
        backup.type,
        filename,
        'success',
        {
          userId: req.user?.id,
          ipAddress: req.ip,
          fileSize: backup.size,
        }
      );

      logger.info('Backup deleted', { filename, user: req.user?.username });

      return res.json({ success: true });
    } catch (error) {
      logger.error('Delete failed', { error: error.message });

      await backupService.logAudit(
        'delete',
        'unknown',
        req.params.filename,
        'failed',
        {
          userId: req.user?.id,
          ipAddress: req.ip,
          error: error.message,
        }
      );

      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
