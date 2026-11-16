/**
 * Eligibility & Ranking Pipeline (Version 3.0)
 * 
 * Non-Negotiable Mandate:
 * Decouples Freshness from Match Scoring.
 * Stage 1 (Hard Eligibility Gate):
 *   - Only jobs with verified posting age <= 30 days are eligible.
 *   - Unknown posting dates are strictly EXCLUDED from the verified Top 20.
 *   - Must have Agent 5 status VERIFIED_DIRECT_URL or VERIFIED_REDIRECT.
 * Stage 2 (Pure Relevance Ranking):
 *   - Calculate candidate relevance score using Agent 3.
 *   - Sort by relevance score descending.
 *   - Take Top 20 (or fewer if fewer than 20 exist). Never pad with old jobs!
 */

const agent5 = require('./agent5-verifier');
const agent3 = require('./agent3-scorer');

/**
 * Calculates posting age in days relative to scan reference date
 */
function calculatePostingFreshness(postingDateStr, scanDateStr = '2026-11-13') {
  if (!postingDateStr || postingDateStr === 'UNKNOWN') {
    return {
      posting_date: 'UNKNOWN',
      posting_age_days: null,
      is_within_30_days: false,
      is_date_known: false,
      freshness_label: 'Date Unknown'
    };
  }

  const postingTime = new Date(postingDateStr).getTime();
  const scanTime = new Date(scanDateStr).getTime();

  if (isNaN(postingTime)) {
    return {
      posting_date: 'UNKNOWN',
      posting_age_days: null,
      is_within_30_days: false,
      is_date_known: false,
      freshness_label: 'Date Unknown'
    };
  }

  const diffMs = scanTime - postingTime;
  const ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const isWithin30 = ageDays <= 30;

  let freshnessLabel = `${ageDays}d ago`;
  if (ageDays === 0) freshnessLabel = 'Today';
  else if (ageDays === 1) freshnessLabel = 'Yesterday';
  else if (ageDays > 30) freshnessLabel = `${Math.round(ageDays / 30)}mo ago (>30d old)`;

  return {
    posting_date: new Date(postingTime).toISOString(),
    posting_age_days: ageDays,
    is_within_30_days: isWithin30,
    is_date_known: true,
    freshness_label: freshnessLabel
  };
}

/**
 * Evaluates Stage 1: Hard Eligibility Gate
 */
function checkEligibility(job, scanDateStr = '2026-11-13') {
  // 1. Freshness evaluation
  const rawDate = job.posting_date || job.postedDate;
  const freshness = calculatePostingFreshness(rawDate, scanDateStr);

  // 2. URL verification evaluation
  const agent5Report = agent5.verifyJobVacancy(job);

  const isValidUrl = 
    agent5Report.url_verification_status === agent5.STATUS.VERIFIED_DIRECT_URL ||
    agent5Report.url_verification_status === agent5.STATUS.VERIFIED_REDIRECT;

  // Stale posting check: > 30 days is disqualified
  const isFresh = freshness.is_within_30_days === true && freshness.is_date_known === true;

  const isEligible = isValidUrl && isFresh;

  let disqualificationReason = null;
  if (!isValidUrl) {
    disqualificationReason = `Agent 5 blocked: ${agent5Report.verification_notes}`;
  } else if (!freshness.is_date_known) {
    disqualificationReason = 'Excluded from Top 20: Original posting date is UNKNOWN.';
  } else if (!freshness.is_within_30_days) {
    disqualificationReason = `Excluded from Top 20: Stale posting (${freshness.freshness_label}). Exceeds 30-day freshness cutoff.`;
  }

  return {
    isEligible,
    disqualificationReason,
    freshness,
    agent5Report
  };
}

/**
 * Executes the Complete Two-Stage Pipeline
 * 
 * @param {Array} jobsList - List of all candidate jobs
 * @param {string} scanDateStr - Reference date (e.g. '2026-11-13')
 * @returns {Object} { top20, eligibleJobs, archivedJobs, stats }
 */
function processEligibilityPipeline(jobsList, scanDateStr = '2026-11-13') {
  const eligibleJobs = [];
  const archivedJobs = [];

  for (const rawJob of (jobsList || [])) {
    const gate = checkEligibility(rawJob, scanDateStr);

    const enriched = {
      ...rawJob,
      posting_date: gate.freshness.posting_date,
      postedDate: gate.freshness.posting_date,
      posting_age_days: gate.freshness.posting_age_days,
      is_within_30_days: gate.freshness.is_within_30_days,
      freshness_label: gate.freshness.freshness_label,
      direct_job_post_url: gate.agent5Report.direct_job_post_url,
      official_application_url: gate.agent5Report.official_application_url,
      applyUrl: gate.agent5Report.official_application_url || gate.agent5Report.direct_job_post_url,
      url_verification_status: gate.agent5Report.url_verification_status,
      is_individual_job_page: gate.agent5Report.is_individual_job_page,
      verification_notes: gate.agent5Report.verification_notes
    };

    if (gate.isEligible) {
      // Stage 2: Calculate Candidate Relevance Score
      const relevance = agent3.calculateRelevanceScore(enriched);

      enriched.match_score = relevance.score;
      enriched.matchScore = relevance.score;
      enriched.matchTier = relevance.tier;
      enriched.fitReason = relevance.explanation;
      enriched.matchedResume = relevance.recommendedResume;
      enriched.portfolioUrl = relevance.portfolioUrl;
      enriched.matchedSkills = relevance.matchedSkills;
      enriched.unmatchedSkills = relevance.unmatchedSkills;
      enriched.matchedDomains = relevance.matchedDomains;
      enriched.scoreBreakdown = relevance.breakdown;
      enriched.eligibility_status = 'ELIGIBLE_FOR_TOP20';

      eligibleJobs.push(enriched);
    } else {
      enriched.eligibility_status = 'ARCHIVED_DISQUALIFIED';
      enriched.disqualification_reason = gate.disqualificationReason;
      archivedJobs.push(enriched);
    }
  }

  // Sort eligible jobs by pure Relevance Score descending
  eligibleJobs.sort((a, b) => {
    if (b.match_score !== a.match_score) {
      return (b.match_score || 0) - (a.match_score || 0);
    }
    // Secondary sort: fresher posting age
    return (a.posting_age_days || 0) - (b.posting_age_days || 0);
  });

  // Pick up to 20 best (never pad with ineligible jobs!)
  const top20 = eligibleJobs.slice(0, 20).map((job, idx) => ({
    ...job,
    rank: idx + 1
  }));

  return {
    top20,
    eligibleCount: eligibleJobs.length,
    archivedCount: archivedJobs.length,
    totalProcessed: jobsList.length,
    stats: {
      eligible: eligibleJobs.length,
      archivedStale: archivedJobs.filter(j => j.disqualification_reason && j.disqualification_reason.includes('Stale')).length,
      archivedUrlBlocked: archivedJobs.filter(j => j.disqualification_reason && j.disqualification_reason.includes('Agent 5')).length,
      archivedUnknownDate: archivedJobs.filter(j => j.disqualification_reason && j.disqualification_reason.includes('UNKNOWN')).length
    }
  };
}

module.exports = {
  calculatePostingFreshness,
  checkEligibility,
  processEligibilityPipeline
};

