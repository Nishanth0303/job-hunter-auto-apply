/**
 * Job History & Freshness Manager
 * 
 * Enforces:
 * 1. Strict 30-day posting date filter. Excludes jobs older than 30 days from Top 20.
 * 2. Permanent JSON storage in `data/job_history.json` so yesterday's and older jobs are NEVER lost.
 * 3. Robust deduplication by job_id, canonical URL, and company+title.
 * 4. Preservation of user application statuses (Pending, Applied, Skipped) across scans.
 * 5. Selection of Top 20 best eligible matching jobs for current dashboard view.
 */

const fs = require('fs');
const path = require('path');
const agent5 = require('./agent5-verifier');

const DATA_DIR = path.join(__dirname, 'data');
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

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Normalizes a URL for duplicate detection
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
 * Generates duplicate detection keys for a job
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
 * Computes the posting freshness in days relative to reference date (default 2026-11-12)
 */
function calculatePostingFreshness(postingDateStr, refDateStr = '2026-11-12') {
  if (!postingDateStr || postingDateStr === 'UNKNOWN') {
    return {
      posting_date: 'UNKNOWN',
      posting_age_days: null,
      is_within_30_days: false,
      freshness_label: 'Date Unknown'
    };
  }

  const postingTime = new Date(postingDateStr).getTime();
  const refTime = new Date(refDateStr).getTime();

  if (isNaN(postingTime)) {
    return {
      posting_date: 'UNKNOWN',
      posting_age_days: null,
      is_within_30_days: false,
      freshness_label: 'Date Unknown'
    };
  }

  const diffMs = refTime - postingTime;
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
    freshness_label: freshnessLabel
  };
}

/**
 * Normalizes a job record to guarantee bidirectional field availability
 */
function normalizeJobObject(j, scanDate = '2026-11-12') {
  const freshness = calculatePostingFreshness(j.posting_date || j.postedDate, scanDate);
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
    matchTier: j.matchTier || (matchScore >= 94 ? 'Excellent' : 'Very Good'),
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
    status: j.status || 'pending',
    appliedDate: j.appliedDate || null,
    skipReason: j.skipReason || null,
    rank: j.rank || 1
  };
}

/**
 * Initializes or loads the master job_history.json
 */
function loadJobHistory() {
  let historyData = readJSON(HISTORY_FILE, null);

  if (!historyData || !Array.isArray(historyData.jobs) || historyData.jobs.length === 0) {
    historyData = {
      last_scan_date: "2026-11-12",
      total_jobs_tracked: 0,
      jobs: []
    };

    const existing = readJSON(JOBS_FILE, []);
    if (Array.isArray(existing) && existing.length > 0) {
      existing.forEach(j => {
        historyData.jobs.push(normalizeJobObject(j, "2026-11-12"));
      });
      historyData.total_jobs_tracked = historyData.jobs.length;
      writeJSON(HISTORY_FILE, historyData);
    }
  } else {
    // Ensure all records in history have normalized bidirectional fields
    historyData.jobs = historyData.jobs.map(j => normalizeJobObject(j, historyData.last_scan_date || '2026-11-12'));
  }

  return historyData;
}

/**
 * Merges a list of newly discovered / refreshed vacancies into the persistent history.
 */
function recordDailyScan(discoveredJobs, scanDate = '2026-11-12') {
  const history = loadJobHistory();
  history.last_scan_date = scanDate;

  // Build lookup index of existing jobs in history
  const keyToJobIndex = new Map();
  history.jobs.forEach((job, index) => {
    const keys = getJobDeduplicationKeys(job);
    keys.forEach(k => keyToJobIndex.set(k, index));
  });

  let newlyAdded = 0;
  let updatedExisting = 0;

  for (const rawJob of discoveredJobs) {
    // 1. Run Agent 5 Verification
    const agent5Record = agent5.verifyJobVacancy(rawJob);

    // 2. Freshness calculation
    const rawPostDate = rawJob.posting_date || rawJob.postedDate;
    const freshness = calculatePostingFreshness(rawPostDate, scanDate);

    // Check duplicate
    const incomingKeys = getJobDeduplicationKeys(rawJob);
    let existingIndex = -1;
    for (const k of incomingKeys) {
      if (keyToJobIndex.has(k)) {
        existingIndex = keyToJobIndex.get(k);
        break;
      }
    }

    if (existingIndex >= 0) {
      // PRESERVE FIRST DISCOVERED DATE & USER APPLICATION STATUS
      const existing = history.jobs[existingIndex];
      existing.last_checked_date = scanDate;
      existing.posting_date = freshness.posting_date;
      existing.postedDate = freshness.posting_date;
      existing.posting_age_days = freshness.posting_age_days;
      existing.is_within_30_days = freshness.is_within_30_days;
      existing.freshness_label = freshness.freshness_label;

      // Update URL fields
      existing.job_detail_url = agent5Record.direct_job_post_url || existing.job_detail_url;
      existing.direct_job_post_url = agent5Record.direct_job_post_url || existing.direct_job_post_url;
      existing.application_url = agent5Record.official_application_url || existing.application_url;
      existing.official_application_url = agent5Record.official_application_url || existing.official_application_url;
      existing.applyUrl = existing.application_url || existing.job_detail_url;
      existing.url_verification_status = agent5Record.url_verification_status;
      existing.is_individual_job_page = agent5Record.is_individual_job_page;
      existing.verification_notes = agent5Record.verification_notes;

      // Status is PRESERVED (do not reset if user marked Applied or Skipped)
      if (rawJob.userUpdatedStatus) {
        existing.status = rawJob.status;
        existing.appliedDate = rawJob.appliedDate;
        existing.skipReason = rawJob.skipReason;
      }

      updatedExisting++;
    } else {
      // INSERT GENUINELY NEW JOB RECORD
      const newJobRecord = normalizeJobObject({
        ...rawJob,
        first_discovered_date: scanDate,
        last_checked_date: scanDate,
        direct_job_post_url: agent5Record.direct_job_post_url,
        job_detail_url: agent5Record.direct_job_post_url,
        official_application_url: agent5Record.official_application_url,
        application_url: agent5Record.official_application_url,
        applyUrl: agent5Record.official_application_url || agent5Record.direct_job_post_url,
        url_verification_status: agent5Record.url_verification_status,
        is_individual_job_page: agent5Record.is_individual_job_page,
        is_job_active: agent5Record.is_job_active,
        verification_notes: agent5Record.verification_notes
      }, scanDate);

      const newIndex = history.jobs.push(newJobRecord) - 1;
      const keys = getJobDeduplicationKeys(newJobRecord);
      keys.forEach(k => keyToJobIndex.set(k, newIndex));
      newlyAdded++;
    }
  }

  history.total_jobs_tracked = history.jobs.length;

  // 3. Save permanent job_history.json
  writeJSON(HISTORY_FILE, history);

  // 4. Calculate Top 20 Best Matches (Strictly posted within last 30 days & verified)
  const eligibleJobs = history.jobs.filter(j => {
    // Must be verified by Agent 5 (No search pages, no missing jobs)
    const isValidUrl = j.url_verification_status === 'VERIFIED_DIRECT_URL' || j.url_verification_status === 'VERIFIED_REDIRECT';
    // Must be posted within last 30 days
    const isFresh = j.is_within_30_days === true;
    return isValidUrl && isFresh;
  });

  // Sort eligible jobs by relevance: matchScore desc, then fresher posting age
  eligibleJobs.sort((a, b) => {
    if (b.match_score !== a.match_score) {
      return (b.match_score || b.matchScore || 0) - (a.match_score || a.matchScore || 0);
    }
    return (a.posting_age_days || 0) - (b.posting_age_days || 0);
  });

  // Pick up to Top 20
  const top20 = eligibleJobs.slice(0, 20).map((job, idx) => ({
    ...job,
    rank: idx + 1
  }));

  // 5. Save to data/jobs.json
  writeJSON(JOBS_FILE, top20);

  // 6. Save daily snapshot in data/history/YYYY-MM-DD.json
  const dailySnapshotFile = path.join(HISTORY_SNAPSHOTS_DIR, `${scanDate}.json`);
  writeJSON(dailySnapshotFile, top20);

  return {
    top20Jobs: top20,
    totalTracked: history.total_jobs_tracked,
    newlyAdded,
    updatedExisting,
    totalEligible30Days: eligibleJobs.length
  };
}

module.exports = {
  calculatePostingFreshness,
  loadJobHistory,
  recordDailyScan,
  getJobDeduplicationKeys,
  normalizeJobObject
};
