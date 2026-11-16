const express = require('express');
const router = express.Router();
const dataService = require('../services/dataService');
const backupService = require('../services/backupService');
const sanitizer = require('../services/sanitizer');
const { requireAdmin } = require('../middleware/auth');
const path = require('path');

// Lazy-load history manager from agents
function getHistoryManager() {
  return require('../../../agents/history-manager');
}

/**
 * GET /api/v1/scan/status
 * Returns current lock status and last scan execution metadata
 */
router.get('/status', (req, res) => {
  const history = dataService.getJobHistory();
  const locked = dataService.isLocked();

  res.json({
    locked,
    last_scan_date: history.last_scan_date,
    total_jobs_tracked: history.total_jobs_tracked,
    top20_count: dataService.getTop20Jobs().length
  });
});

/**
 * POST /api/v1/scan/trigger
 * Requires Admin Authentication. Executes the job hunting pipeline with lock protection.
 */
router.post('/trigger', requireAdmin, async (req, res) => {
  const lockResult = dataService.acquireLock('daily_scan');

  if (!lockResult.acquired) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A scan is already in progress.',
      reason: lockResult.reason
    });
  }

  try {
    // 1. Take pre-scan safety backup
    const backupResult = backupService.createBackup('pre-scan');
    console.log('[Scan] Pre-scan backup created:', backupResult.backupFile);

    // 2. Run scan pipeline
    const historyManager = getHistoryManager();
    const scanDate = req.body.scanDate || new Date().toISOString().slice(0, 10);
    const discoveredJobs = req.body.discoveredJobs || [];

    const scanResult = historyManager.recordDailyScan(discoveredJobs, scanDate);

    // 3. Generate sanitized public feed for GitHub Pages
    sanitizer.generatePublicFeed(scanResult.top20Jobs);

    // 4. Release lock
    dataService.releaseLock();

    return res.json({
      success: true,
      message: `Daily scan completed for ${scanDate}`,
      scanDate,
      stats: {
        totalTracked: scanResult.totalTracked,
        newlyAdded: scanResult.newlyAdded,
        updatedExisting: scanResult.updatedExisting,
        totalEligible30Days: scanResult.totalEligible30Days,
        top20Count: scanResult.top20Jobs.length
      },
      backupCreated: backupResult.backupFile
    });
  } catch (err) {
    dataService.releaseLock();
    console.error('[Scan] Scan failed with error:', err);
    return res.status(500).json({
      error: 'Scan Execution Failed',
      message: err.message
    });
  }
});

module.exports = router;

