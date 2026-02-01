/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Backup/restore routes for configuration data
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const backupService = require('../services/backupService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');

const logger = createLogger('BackupRoutes');

// All backup routes require admin access
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @swagger
 * /api/backup/export:
 *   post:
 *     summary: Create and export configuration backup
 *     description: Creates encrypted or plaintext backup with all configuration data
 */
router.post('/export', async (req, res) => {
  try {
    const { 
      encrypted = true, 
      password, 
      includePatterns = true 
    } = req.body;

    // Validate password for encrypted backups
    if (encrypted && (!password || password.length < 8)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters for encrypted backups' 
      });
    }

    // Create backup
    const result = await backupService.createBackup({
      encrypted,
      password,
      includePatterns
    });

    // Log audit
    await backupService.logAudit(
      'export',
      encrypted ? 'encrypted' : 'plaintext',
      result.filename,
      'success',
      {
        userId: req.user?.id,
        ipAddress: req.ip,
        fileSize: result.size,
        metadata: { includePatterns }
      }
    );

    logger.info('Backup created', { 
      filename: result.filename, 
      encrypted, 
      user: req.user?.username 
    });

    res.json({
      success: true,
      filename: result.filename,
      size: result.size,
      encrypted,
      timestamp: result.timestamp
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
        error: error.message
      }
    );
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/backup/import:
 *   post:
 *     summary: Import and restore configuration from backup
 */
router.post('/import', async (req, res) => {
  try {
    const { 
      filename, 
      password, 
      mode = 'replace' // 'replace' or 'merge'
    } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const result = await backupService.restoreBackup(filename, {
      password,
      mode,
      userId: req.user?.id
    });

    // Log audit
    await backupService.logAudit(
      'import',
      filename.endsWith('.enc.json') ? 'encrypted' : 'plaintext',
      filename,
      'success',
      {
        userId: req.user?.id,
        ipAddress: req.ip,
        metadata: { mode, stats: result.stats }
      }
    );

    logger.info('Backup restored', { 
      filename, 
      mode, 
      user: req.user?.username,
      stats: result.stats 
    });

    res.json({
      success: true,
      newApiKey: result.newApiKey,
      stats: result.stats
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
        error: error.message
      }
    );
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/backup/list:
 *   get:
 *     summary: List all available backups
 */
router.get('/list', async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    res.json({ backups });
  } catch (error) {
    logger.error('Failed to list backups', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/backup/download/:filename:
 *   get:
 *     summary: Download a backup file
 */
router.get('/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const backups = await backupService.listBackups();
    const backup = backups.find(b => b.filename === filename);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const BACKUP_DIR = process.env.BACKUP_DIR || '/app/data/backups';
    const filepath = path.join(BACKUP_DIR, filename);

    // Log audit
    await backupService.logAudit(
      'download',
      backup.type,
      filename,
      'success',
      {
        userId: req.user?.id,
        ipAddress: req.ip,
        fileSize: backup.size
      }
    );

    res.download(filepath, filename, (err) => {
      if (err) {
        logger.error('Download failed', { filename, error: err.message });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  } catch (error) {
    logger.error('Download failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/backup/preview:
 *   post:
 *     summary: Preview backup contents before restoring
 */
router.post('/preview', async (req, res) => {
  try {
    const { filename, password } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
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
        autoLearnedPreferences: backupData.data.autoLearnedPreferences?.length || 0
      }
    };

    res.json(preview);
  } catch (error) {
    logger.error('Preview failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/backup/:filename:
 *   delete:
 *     summary: Delete a backup file
 */
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const backups = await backupService.listBackups();
    const backup = backups.find(b => b.filename === filename);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    await backupService.deleteBackup(filename);

    // Log audit
    await backupService.logAudit(
      'delete',
      backup.type,
      filename,
      'success',
      {
        userId: req.user?.id,
        ipAddress: req.ip,
        fileSize: backup.size
      }
    );

    logger.info('Backup deleted', { filename, user: req.user?.username });

    res.json({ success: true });
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
        error: error.message
      }
    );
    
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
