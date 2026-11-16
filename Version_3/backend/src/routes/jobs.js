const express = require('express');
const router = express.Router();
const dataService = require('../services/dataService');
const sanitizer = require('../services/sanitizer');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/v1/jobs
 * Returns the active Top 20 eligible jobs (sanitized for public, complete for authenticated)
 */
router.get('/', (req, res) => {
  const top20 = dataService.getTop20Jobs();
  const statusFilter = req.query.status;
  const portalFilter = req.query.portal;

  let filtered = top20;

  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter(j => j.status === statusFilter);
  }

  if (portalFilter && portalFilter !== 'all') {
    filtered = filtered.filter(j => (j.portal || j.source || '').toLowerCase() === portalFilter.toLowerCase());
  }

  const sanitized = filtered.map(sanitizer.sanitizeJobForPublic);
  res.json({
    total: sanitized.length,
    jobs: sanitized
  });
});

/**
 * GET /api/v1/jobs/history
 * Requires Authentication. Returns the permanent historical job records with search & filters.
 */
router.get('/history', requireAuth, (req, res) => {
  const history = dataService.getJobHistory();
  const query = (req.query.q || '').toLowerCase();
  const status = req.query.status;
  const minAge = req.query.minAge ? parseInt(req.query.minAge, 10) : null;
  const maxAge = req.query.maxAge ? parseInt(req.query.maxAge, 10) : null;

  let jobs = history.jobs || [];

  if (query) {
    jobs = jobs.filter(j =>
      (j.job_title || j.title || '').toLowerCase().includes(query) ||
      (j.company || j.company_name || '').toLowerCase().includes(query) ||
      (j.location || '').toLowerCase().includes(query) ||
      (j.description || '').toLowerCase().includes(query)
    );
  }

  if (status && status !== 'all') {
    jobs = jobs.filter(j => j.status === status);
  }

  if (minAge !== null) {
    jobs = jobs.filter(j => (j.posting_age_days !== null && j.posting_age_days >= minAge));
  }

  if (maxAge !== null) {
    jobs = jobs.filter(j => (j.posting_age_days !== null && j.posting_age_days <= maxAge));
  }

  res.json({
    last_scan_date: history.last_scan_date,
    total_tracked: history.total_jobs_tracked,
    count: jobs.length,
    jobs
  });
});

/**
 * GET /api/v1/jobs/:id
 * Retrieve a specific job by ID
 */
router.get('/:id', (req, res) => {
  const history = dataService.getJobHistory();
  const job = history.jobs.find(j => (j.job_id === req.params.id || j.id === req.params.id));

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(sanitizer.sanitizeJobForPublic(job));
});

/**
 * PATCH /api/v1/jobs/:id/status
 * Requires Authentication. Manually update a job's tracking status with explicit confirmation.
 * Supported: pending_review, saved, application_opened, applied, interview, offer_received, rejected, skipped
 */
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status, skipReason, userNotes } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status field is required' });
  }

  const result = dataService.updateJobStatus(req.params.id, {
    status,
    skipReason,
    userNotes,
    appliedDate: status === 'applied' ? new Date().toISOString() : undefined
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({
    success: true,
    message: `Job ${req.params.id} updated to status "${status}"`,
    job: result.job
  });
});

module.exports = router;

