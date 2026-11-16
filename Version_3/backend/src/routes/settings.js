const express = require('express');
const router = express.Router();
const dataService = require('../services/dataService');
const sanitizer = require('../services/sanitizer');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/v1/settings
 * Returns candidate profile and scoring configuration
 */
router.get('/', (req, res) => {
  const profile = dataService.getCandidateProfile();
  const scoring = dataService.getScoringConfig();

  // If unauthenticated, return sanitized profile
  if (!req.headers['authorization']) {
    return res.json({
      candidate: sanitizer.sanitizeCandidateProfile(profile).candidate,
      scoring
    });
  }

  res.json({
    candidate: profile.candidate,
    scoring
  });
});

/**
 * POST /api/v1/settings/scoring
 * Requires Admin Auth. Updates scoring weights and eligibility settings.
 */
router.post('/scoring', requireAdmin, (req, res) => {
  const current = dataService.getScoringConfig();
  const updated = { ...current, ...req.body, updated_at: new Date().toISOString() };
  
  dataService.atomicWriteJSON(require('../config').paths.scoringConfigFile, updated);

  res.json({
    success: true,
    message: 'Scoring settings updated successfully',
    scoring: updated
  });
});

module.exports = router;

