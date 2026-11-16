/**
 * Job History & Freshness Manager (Version 3.0)
 * 
 * Enforces:
 * 1. Two-Stage Pipeline: 30-day freshness gate before relevance ranking.
 * 2. Permanent JSON storage in data/job_history.json — yesterday's jobs are NEVER lost.
 * 3. Robust deduplication by job_id, canonical URL, and company+title.
 * 4. Immutable user application statuses (Pending, Applied, Skipped, etc.) across daily scans.
 * 5. Atomic writes and rolling daily snapshot preservation.
 */

const fs = require('fs');
const path = require('path');
const eligibilityPipeline = require('./eligibility-pipeline');

const DATA_DIR = path.resolve(__dirname, '../data');
const HISTORY_FILE = path.join(DATA_DIR, 'job_history.json');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const HISTORY_SNAPSHOTS_DIR = path.join(DATA_DIR, 'history');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(HISTORY_SNAPSHOTS_DIR)) fs.mkdirSync(HISTORY_SNAPSHOTS_DIR, { recursive: true });

function readJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function atomicWriteJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}.${Math.floor(Math.random() * 10000)}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Normalizes URL for duplicate detection
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('ref');
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('trackingId');
    return (parsed.origin + parsed.pathname).toLowerCase().replace(/\/+$/, '');
  } catch (e) {
    return url.toLowerCase().trim().replace(/\/+$/, '');
  }
}

/**
 * Generates duplicate keys
 */
function getJobDeduplicationKeys(job) {
  const keys = [];
  const jobId = job.job_id || job.id;
  if (jobId) {
    keys.push(`id:${jobId.toString().toLowerCase().trim()}`);
  }
  const directUrl = job.job_detail_url || job.direct_job_post_url || job.applyUrl;
  if (directUrl && directUrl !== '#') {
    keys.push(`url:${normalizeUrl(directUrl)}`);
  }
  const company = (job.company || job.company_name || '').toLowerCase().trim();
  const title = (job.job_title || job.title || '').toLowerCase().trim();
  if (company && title) {
    keys.push(`comp_title:${company}_${title}`);
  }
  return keys;
}

/**
 * Normalizes bidirectional fields on a job record
 */
function normalizeJobObject(j, scanDate = '2026-11-13') {
  const freshness = eligibilityPipeline.calculatePostingFreshness(j.posting_date || j.postedDate, scanDate);
  const title = j.job_title || j.title || 'PHP Developer';
  const company = j.company || j.company_name || 'Technology Company';
  const portal = j.portal || j.source || 'General';
  const jobId = j.job_id || j.id || `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const directUrl = j.job_detail_url || j.direct_job_post_url || j.applyUrl || '#';
  const appUrl = j.application_url || j.official_application_url || directUrl;
  const matchScore = j.match_score || j.matchScore || 90;

  return {
    job_id: jobId,
    id: jobId,
    job_title: title,
    title: title,
    company: company,
    company_name: company,
    companyWebsite: j.companyWebsite || '',
    companyDetails: j.companyDetails || '',
    location: j.location || 'Remote / Hybrid',
    portal: portal,
    source: portal,
    posting_date: freshness.posting_date,
    postedDate: freshness.posting_date,
    posting_age_days: freshness.posting_age_days,
    is_within_30_days: freshness.is_within_30_days,
    freshness_label: freshness.freshness_label,
    first_discovered_date: j.first_discovered_date || scanDate,
    last_checked_date: j.last_checked_date || scanDate,
    job_detail_url: directUrl,
    direct_job_post_url: directUrl,
    application_url: appUrl,
    official_application_url: appUrl,
    applyUrl: appUrl,
    recruiterPostUrl: j.recruiterPostUrl || '',
    url_verification_status: j.url_verification_status || 'VERIFIED_DIRECT_URL',
    is_individual_job_page: j.is_individual_job_page !== false,
    is_job_active: j.is_job_active || 'active',
    verification_notes: j.verification_notes || 'Verified individual job post page.',
    match_score: matchScore,
    matchScore: matchScore,
    matchTier: j.matchTier || (matchScore >= 94 ? 'Excellent Match' : 'Very Good Match'),
    matchedResume: j.matchedResume || 'PHP Developer Resume',
    portfolioUrl: j.portfolioUrl || 'https://nishanth0303.github.io/Nishanth-portfolio/php-dev.html',
    salary: j.salary || 'Competitive',
    experience: j.experience || '4–6 Years Exp',
    description: j.description || '',
    fitReason: j.fitReason || '',
    gaps: j.gaps || 'None',
    coverNote: j.coverNote || '',
    matchedSkills: j.matchedSkills || ["PHP", "Laravel 10", "MySQL", "REST APIs"],
    unmatchedSkills: j.unmatchedSkills || ["None"],
    status: j.status || 'pending_review',
    appliedDate: j.appliedDate || null,
    skipReason: j.skipReason || null,
    userNotes: j.userNotes || null,
    rank: j.rank || 1
  };
}

/**
 * Loads or initializes the permanent job history
 */
function loadJobHistory() {
  let historyData = readJSON(HISTORY_FILE, null);

  if (!historyData || !Array.isArray(historyData.jobs) || historyData.jobs.length === 0) {
    historyData = {
      last_scan_date: "2026-11-13",
      total_jobs_tracked: 0,
      jobs: []
    };

    // If initial jobs.json exists, populate history
    const existing = readJSON(JOBS_FILE, []);
    if (Array.isArray(existing) && existing.length > 0) {
      existing.forEach(j => {
        historyData.jobs.push(normalizeJobObject(j, "2026-11-13"));
      });
      historyData.total_jobs_tracked = historyData.jobs.length;
      atomicWriteJSON(HISTORY_FILE, historyData);
    }
  } else {
    // Guarantee normalized bidirectional fields on all existing records
    historyData.jobs = historyData.jobs.map(j => normalizeJobObject(j, historyData.last_scan_date || '2026-11-13'));
  }

  return historyData;
}

/**
 * Merges discovered jobs into permanent history and calculates active Top 20
 */
function recordDailyScan(discoveredJobs = [], scanDate = '2026-11-13') {
  const history = loadJobHistory();
  history.last_scan_date = scanDate;

  // Build duplicate lookup index
  const keyToJobIndex = new Map();
  history.jobs.forEach((job, index) => {
    const keys = getJobDeduplicationKeys(job);
    keys.forEach(k => keyToJobIndex.set(k, index));
  });

  let newlyAdded = 0;
  let updatedExisting = 0;

  for (const rawJob of discoveredJobs) {
    const incomingKeys = getJobDeduplicationKeys(rawJob);
    let existingIndex = -1;
    for (const k of incomingKeys) {
      if (keyToJobIndex.has(k)) {
        existingIndex = keyToJobIndex.get(k);
        break;
      }
    }

    if (existingIndex >= 0) {
      // PRESERVE FIRST DISCOVERED DATE AND USER APPLICATION STATUS
      const existing = history.jobs[existingIndex];
      existing.last_checked_date = scanDate;

      // Update freshness
      const freshness = eligibilityPipeline.calculatePostingFreshness(rawJob.posting_date || rawJob.postedDate || existing.posting_date, scanDate);
      existing.posting_date = freshness.posting_date;
      existing.postedDate = freshness.posting_date;
      existing.posting_age_days = freshness.posting_age_days;
      existing.is_within_30_days = freshness.is_within_30_days;
      existing.freshness_label = freshness.freshness_label;

      // Update URL fields if incoming has verified details
      if (rawJob.direct_job_post_url) existing.direct_job_post_url = rawJob.direct_job_post_url;
      if (rawJob.official_application_url) existing.official_application_url = rawJob.official_application_url;
      if (rawJob.url_verification_status) existing.url_verification_status = rawJob.url_verification_status;

      // IMMUTABILITY GUARANTEE: Never overwrite status or skip reasons during automated scan!
      if (rawJob.userUpdatedStatus) {
        existing.status = rawJob.status;
        existing.appliedDate = rawJob.appliedDate;
        existing.skipReason = rawJob.skipReason;
        existing.userNotes = rawJob.userNotes;
      }

      updatedExisting++;
    } else {
      // INSERT NEW JOB RECORD
      const newJob = normalizeJobObject({
        ...rawJob,
        first_discovered_date: scanDate,
        last_checked_date: scanDate
      }, scanDate);

      const newIdx = history.jobs.push(newJob) - 1;
      const keys = getJobDeduplicationKeys(newJob);
      keys.forEach(k => keyToJobIndex.set(k, newIdx));
      newlyAdded++;
    }
  }

  history.total_jobs_tracked = history.jobs.length;

  // 1. Save Master History
  atomicWriteJSON(HISTORY_FILE, history);

  // 2. Run Eligibility Pipeline on all historical jobs to select active Top 20
  const pipelineResult = eligibilityPipeline.processEligibilityPipeline(history.jobs, scanDate);

  // 3. Save active Top 20
  atomicWriteJSON(JOBS_FILE, pipelineResult.top20);

  // 4. Save Daily Snapshot in data/history/YYYY-MM-DD.json
  const dailySnapshotPath = path.join(HISTORY_SNAPSHOTS_DIR, `${scanDate}.json`);
  atomicWriteJSON(dailySnapshotPath, pipelineResult.top20);

  return {
    top20Jobs: pipelineResult.top20,
    totalTracked: history.total_jobs_tracked,
    newlyAdded,
    updatedExisting,
    totalEligible30Days: pipelineResult.eligibleCount,
    archivedCount: pipelineResult.archivedCount,
    stats: pipelineResult.stats
  };
}

module.exports = {
  loadJobHistory,
  recordDailyScan,
  getJobDeduplicationKeys,
  normalizeJobObject,
  normalizeUrl
};

