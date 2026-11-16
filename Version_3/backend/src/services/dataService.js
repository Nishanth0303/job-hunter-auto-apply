const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure directories exist
[config.paths.dataDir, config.paths.backupDir, config.paths.configDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Atomic JSON write: writes to temporary file then renames atomically
 */
function atomicWriteJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmpPath = `${filePath}.${Date.now()}.${Math.floor(Math.random() * 10000)}.tmp`;
  const serialized = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpPath, serialized, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Safe JSON read
 */
function safeReadJSON(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[DataService] Error reading JSON from ${filePath}:`, err.message);
    return fallback;
  }
}

/**
 * Concurrency Lock Management
 */
function acquireLock(operationName = 'scan', maxAgeMs = 30 * 60 * 1000) {
  const lockFile = config.paths.lockFile;
  
  if (fs.existsSync(lockFile)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      const age = Date.now() - new Date(lockData.acquired_at).getTime();
      
      if (age < maxAgeMs) {
        return {
          acquired: false,
          reason: `Lock held by process ${lockData.pid} for ${lockData.operation} (acquired ${Math.round(age / 1000)}s ago)`,
          lockData
        };
      }
      console.warn(`[DataService] Evicting stale lock (age ${Math.round(age / 1000)}s) held by pid ${lockData.pid}`);
    } catch (e) {
      console.warn('[DataService] Corrupted lock file encountered, evicting');
    }
  }

  const newLock = {
    pid: process.pid,
    operation: operationName,
    acquired_at: new Date().toISOString()
  };

  try {
    fs.writeFileSync(lockFile, JSON.stringify(newLock, null, 2), 'utf8');
    return { acquired: true, lockData: newLock };
  } catch (err) {
    return { acquired: false, reason: `Failed to create lock file: ${err.message}` };
  }
}

function releaseLock() {
  const lockFile = config.paths.lockFile;
  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
    return true;
  } catch (err) {
    console.error('[DataService] Error releasing lock:', err.message);
    return false;
  }
}

function isLocked() {
  const lockFile = config.paths.lockFile;
  if (!fs.existsSync(lockFile)) return false;
  try {
    const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    const age = Date.now() - new Date(lockData.acquired_at).getTime();
    return age < 30 * 60 * 1000;
  } catch (e) {
    return false;
  }
}

// Data Access Methods (Storage Abstraction)

function getJobHistory() {
  return safeReadJSON(config.paths.historyFile, {
    last_scan_date: null,
    total_jobs_tracked: 0,
    jobs: []
  });
}

function saveJobHistory(historyData) {
  atomicWriteJSON(config.paths.historyFile, historyData);
}

function getTop20Jobs() {
  return safeReadJSON(config.paths.jobsFile, []);
}

function saveTop20Jobs(jobs) {
  atomicWriteJSON(config.paths.jobsFile, jobs);
}

function getCandidateProfile() {
  return safeReadJSON(config.paths.candidateConfigFile, {});
}

function getScoringConfig() {
  return safeReadJSON(config.paths.scoringConfigFile, {});
}

/**
 * Manually update a job status (Candidate dashboard control)
 * Valid statuses: pending_review, saved, application_opened, applied, interview, offer_received, rejected, skipped
 */
function updateJobStatus(jobId, updates) {
  const history = getJobHistory();
  const job = history.jobs.find(j => (j.job_id === jobId || j.id === jobId));
  
  if (!job) {
    return { success: false, error: 'Job not found in history' };
  }

  const validStatuses = [
    'pending_review',
    'saved',
    'application_opened',
    'applied',
    'interview',
    'offer_received',
    'rejected',
    'skipped'
  ];

  if (updates.status && !validStatuses.includes(updates.status)) {
    return { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
  }

  if (updates.status) job.status = updates.status;
  if (updates.status === 'applied') job.appliedDate = updates.appliedDate || new Date().toISOString();
  if (updates.status === 'application_opened') job.applicationOpenedAt = new Date().toISOString();
  if (updates.skipReason !== undefined) job.skipReason = updates.skipReason;
  if (updates.userNotes !== undefined) job.userNotes = updates.userNotes;
  job.last_updated_at = new Date().toISOString();

  // Save history
  saveJobHistory(history);

  // Sync with Top 20 if present
  const top20 = getTop20Jobs();
  const top20Idx = top20.findIndex(j => (j.job_id === jobId || j.id === jobId));
  if (top20Idx >= 0) {
    top20[top20Idx] = { ...top20[top20Idx], ...updates, last_updated_at: job.last_updated_at };
    saveTop20Jobs(top20);
  }

  return { success: true, job };
}

module.exports = {
  atomicWriteJSON,
  safeReadJSON,
  acquireLock,
  releaseLock,
  isLocked,
  getJobHistory,
  saveJobHistory,
  getTop20Jobs,
  saveTop20Jobs,
  getCandidateProfile,
  getScoringConfig,
  updateJobStatus
};

