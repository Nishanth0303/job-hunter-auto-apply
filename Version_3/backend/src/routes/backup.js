const express = require('express');
const router = express.Router();
const backupService = require('../services/backupService');
const { requireAdmin } = require('../middleware/auth');

/**
 * All backup routes require Admin authorization
 */
router.use(requireAdmin);

/**
 * POST /api/v1/admin/backup
 * Creates an on-demand backup snapshot
 */
router.post('/backup', (req, res) => {
  const tag = req.body.tag || 'manual';
  const result = backupService.createBackup(tag);

  if (!result.success) {
    return res.status(500).json(result);
  }

  res.json({
    success: true,
    message: 'Backup created successfully',
    backup: result
  });
});

/**
 * GET /api/v1/admin/backups
 * Lists all available backup files with checksums
 */
router.get('/backups', (req, res) => {
  const backups = backupService.listBackups();
  res.json({
    count: backups.length,
    backups
  });
});

/**
 * POST /api/v1/admin/restore
 * Verifies checksum and restores from specified backup
 */
router.post('/restore', (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'filename is required in request body' });
  }

  const result = backupService.restoreBackup(filename);

  if (!result.success) {
    return res.status(500).json(result);
  }

  res.json({
    success: true,
    message: `Restored successfully from ${filename}`,
    details: result
  });
});

module.exports = router;

