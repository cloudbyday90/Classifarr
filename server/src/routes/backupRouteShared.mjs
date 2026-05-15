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

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';

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

  router.post('/export', asyncHandler(async (req, res) => {
    const {
      encrypted = true,
      password,
      includePatterns = true,
    } = req.body;

    if (encrypted && !backupService.isValidEncryptedBackupPassword(password)) {
      return sendError(res, backupService.ENCRYPTED_BACKUP_PASSWORD_ERROR);
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

    return sendSuccess(res, {
      filename: result.filename,
      size: result.size,
      encrypted,
      timestamp: result.timestamp,
    });
  }));

  router.post('/import', asyncHandler(async (req, res) => {
    const {
      filename,
      password,
      mode = 'replace',
    } = req.body;

    if (!filename) {
      return sendError(res, 'Filename is required');
    }

    if (isInvalidFilename(filename)) {
      return sendError(res, 'Invalid filename');
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

    return sendSuccess(res, {
      newApiKey: result.newApiKey,
      stats: result.stats,
    });
  }));

  router.get('/list', asyncHandler(async (_req, res) => {
    const backups = await backupService.listBackups();
    return sendData(res, { backups });
  }));

  router.get('/download/:filename', asyncHandler(async (req, res) => {
    const { filename } = req.params;

    if (isInvalidFilename(filename)) {
      return sendError(res, 'Invalid filename');
    }

    const backups = await backupService.listBackups();
    const backup = backups.find((entry) => entry.filename === filename);

    if (!backup) {
      return sendError(res, 'Backup not found', 404);
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
          sendError(res, 'Download failed', 500);
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
  }));

  router.post('/preview', asyncHandler(async (req, res) => {
    const { filename, password } = req.body;

    if (!filename) {
      return sendError(res, 'Filename is required');
    }

    if (isInvalidFilename(filename)) {
      return sendError(res, 'Invalid filename');
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

    return sendData(res, preview);
  }));

  router.delete('/:filename', asyncHandler(async (req, res) => {
    const { filename } = req.params;

    if (isInvalidFilename(filename)) {
      return sendError(res, 'Invalid filename');
    }

    const backups = await backupService.listBackups();
    const backup = backups.find((entry) => entry.filename === filename);

    if (!backup) {
      return sendError(res, 'Backup not found', 404);
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

    return sendSuccess(res);
  }));

  return router;
}
