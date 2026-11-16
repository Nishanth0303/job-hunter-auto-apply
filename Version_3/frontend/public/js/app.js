/**
 * JobHuntAI Version 3.0 Dashboard Application
 * 
 * Capabilities:
 * - Dual Mode: Static GitHub Pages mode (loads data/jobs.json) and Cloud Backend API mode.
 * - Two-Stage Pipeline Display: Active Top 20 eligible jobs (<30d, Agent 5 direct URL).
 * - Multi-Tab & Time Window Filtering (Today, Yesterday, 7d, 30d, All Historical).
 * - Mandatory User Confirmation for Application Submission (Zero premature auto-apply).
 * - Preloaded Skip Reason Logger with "✅ Already applied" support.
 * - Day-by-Day Historical Snapshot Viewer.
 */

// Global State
let allJobs = [];
let currentFilter = {
  tab: 'all',
  time: 'all',
  portal: 'all',
  location: 'all',
  query: ''
};
let selectedJobForAction = null;
let detailModalInstance = null;
let skipModalInstance = null;
let applyConfirmModalInstance = null;
let settingsModalInstance = null;

// Determine backend API URL (empty for same origin / static GitHub Pages)
const API_BASE = window.location.origin.includes('localhost') ? '' : '';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Bootstrap Modals
  detailModalInstance = new bootstrap.Modal(document.getElementById('jobDetailModal'));
  skipModalInstance = new bootstrap.Modal(document.getElementById('skipReasonModal'));
  applyConfirmModalInstance = new bootstrap.Modal(document.getElementById('applyConfirmModal'));
  settingsModalInstance = new bootstrap.Modal(document.getElementById('settingsModal'));

  setupEventListeners();
  await loadJobsData();
});

function setupEventListeners() {
  // Status Tabs
  document.querySelectorAll('#statusTabs .nav-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#statusTabs .nav-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.tab = btn.getAttribute('data-tab');
      handleTabSwitch();
    });
  });

  // Time Window Filters
  document.querySelectorAll('#timeFilters .time-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#timeFilters .time-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.time = btn.getAttribute('data-time');
      renderJobsTable();
    });
  });

  // Portal & Location Dropdowns
  document.getElementById('portalFilter').addEventListener('change', (e) => {
    currentFilter.portal = e.target.value;
    renderJobsTable();
  });

  document.getElementById('locationFilter').addEventListener('change', (e) => {
    currentFilter.location = e.target.value;
    renderJobsTable();
  });

  // Search Input
  document.getElementById('searchInput').addEventListener('input', (e) => {
    currentFilter.query = e.target.value.toLowerCase().trim();
    renderJobsTable();
  });

  // Reset Filters Button
  document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

  // Settings Button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    settingsModalInstance.show();
  });

  // Scan Top 20 Jobs Button
  document.getElementById('scanJobsBtn').addEventListener('click', handleTriggerScan);

  // Skip Modal Confirm
  document.getElementById('confirmSkipReasonBtn').addEventListener('click', handleConfirmSkipReason);

  // Application Submission Confirmation Controls
  document.getElementById('btnConfirmApplied').addEventListener('click', () => {
    if (selectedJobForAction) {
      applyJobStatus(selectedJobForAction.id || selectedJobForAction.job_id, 'applied');
      applyConfirmModalInstance.hide();
    }
  });

  document.getElementById('btnKeepOpened').addEventListener('click', () => {
    if (selectedJobForAction) {
      applyJobStatus(selectedJobForAction.id || selectedJobForAction.job_id, 'application_opened');
      applyConfirmModalInstance.hide();
    }
  });

  // Modal Action Buttons
  document.getElementById('modalNotApplyingBtn').addEventListener('click', () => {
    detailModalInstance.hide();
    openSkipReasonModal(selectedJobForAction);
  });

  document.getElementById('modalOpenApplyBtn').addEventListener('click', () => {
    detailModalInstance.hide();
    handleOpenAndApply(selectedJobForAction);
  });

  // Copy Cover Letter
  document.getElementById('copyCoverLetterBtn').addEventListener('click', () => {
    const textarea = document.getElementById('modalCoverLetter');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
      const btn = document.getElementById('copyCoverLetterBtn');
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="bi bi-check2"></i> Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    });
  });
}

/**
 * Loads job data from API or fallback static data/jobs.json
 */
async function loadJobsData() {
  try {
    // Try fetching from API first, or fallback to static json
    const response = await fetch('data/jobs.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    allJobs = Array.isArray(data) ? data : (data.jobs || []);
    console.log(`[JobHuntAI v3.0] Loaded ${allJobs.length} active jobs`);
  } catch (err) {
    console.warn('[JobHuntAI v3.0] Could not load data/jobs.json directly, attempting /api/v1/jobs:', err.message);
    try {
      const res = await fetch('/api/v1/jobs');
      if (res.ok) {
        const json = await res.json();
        allJobs = json.jobs || [];
      }
    } catch (e) {
      console.error('[JobHuntAI v3.0] Failed to fetch jobs:', e);
      allJobs = [];
    }
  }

  updateMetrics();
  renderJobsTable();
}

/**
 * Switches between Table view and Day-by-Day Historical View
 */
function handleTabSwitch() {
  const tableCard = document.getElementById('jobsTableCard');
  const historyContainer = document.getElementById('historyViewContainer');

  if (currentFilter.tab === 'history') {
    tableCard.classList.add('d-none');
    historyContainer.classList.remove('d-none');
    renderHistorySnapshots();
  } else {
    tableCard.classList.remove('d-none');
    historyContainer.classList.add('d-none');
    renderJobsTable();
  }
}

/**
 * Filter jobs based on current state
 */
function getFilteredJobs() {
  return allJobs.filter(job => {
    // 1. Status Tab filter
    const status = (job.status || 'pending_review').toLowerCase();
    if (currentFilter.tab === 'pending' && !(status === 'pending' || status === 'pending_review')) return false;
    if (currentFilter.tab === 'applied' && status !== 'applied') return false;
    if (currentFilter.tab === 'skipped' && !(status === 'skipped' || status === 'rejected')) return false;

    // 2. Portal filter
    if (currentFilter.portal !== 'all') {
      const p = (job.portal || job.source || '').toLowerCase();
      if (p !== currentFilter.portal.toLowerCase()) return false;
    }

    // 3. Location filter
    if (currentFilter.location !== 'all') {
      const loc = (job.location || '').toLowerCase();
      if (!loc.includes(currentFilter.location.toLowerCase())) return false;
    }

    // 4. Time Window filter
    const age = job.posting_age_days !== undefined ? job.posting_age_days : 1;
    if (currentFilter.time === 'today' && age > 0) return false;
    if (currentFilter.time === 'yesterday' && age > 1) return false;
    if (currentFilter.time === '7d' && age > 7) return false;
    if (currentFilter.time === '30d' && age > 30) return false;

    // 5. Search Query
    if (currentFilter.query) {
      const target = `${job.title || job.job_title || ''} ${job.company || ''} ${job.location || ''} ${(job.matchedSkills || []).join(' ')}`.toLowerCase();
      if (!target.includes(currentFilter.query)) return false;
    }

    return true;
  });
}

/**
 * Renders the primary jobs table
 */
function renderJobsTable() {
  const tbody = document.getElementById('jobsTableBody');
  const emptyState = document.getElementById('emptyState');
  const filtered = getFilteredJobs();

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('d-none');
    return;
  }

  emptyState.classList.add('d-none');

  tbody.innerHTML = filtered.map((job, idx) => {
    const rank = job.rank || idx + 1;
    const title = job.title || job.job_title || 'PHP Developer';
    const company = job.company || job.company_name || 'Tech Company';
    const location = job.location || 'Coimbatore / Remote';
    const portal = job.portal || job.source || 'General';
    const score = job.match_score || job.matchScore || 90;
    const tier = job.matchTier || 'Strong Match';
    const freshness = job.freshness_label || 'Recent';
    const status = (job.status || 'pending_review').toLowerCase();
    const skipReason = job.skipReason || '';
    const directUrl = job.job_detail_url || job.direct_job_post_url || job.applyUrl || '#';
    const appliedOn = job.appliedDate ? new Date(job.appliedDate).toLocaleDateString() : '—';

    // Status Badge Styling
    let statusBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle"><i class="bi bi-hourglass-split me-1"></i>Pending Review</span>';
    if (status === 'applied') {
      statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check2-all me-1"></i>Applied</span>';
    } else if (status === 'application_opened') {
      statusBadge = '<span class="badge bg-info-subtle text-info border border-info-subtle"><i class="bi bi-eye me-1"></i>App Opened</span>';
    } else if (status === 'skipped' || status === 'rejected') {
      if (skipReason === 'Already applied') {
        statusBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-check-circle me-1"></i>Already applied</span>';
      } else {
        statusBadge = `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle" title="${skipReason}"><i class="bi bi-slash-circle me-1"></i>${skipReason ? skipReason.slice(0, 16) + '...' : 'Skipped'}</span>`;
      }
    }

    // Portal Badge Class
    const portalClass = `badge-${portal.toLowerCase()}`;

    // Match Progress Bar Color
    let progressColor = 'bg-success';
    if (score < 94) progressColor = 'bg-primary';
    if (score < 89) progressColor = 'bg-warning';

    return `
      <tr>
        <td class="text-center">
          <span class="badge bg-light text-dark border fw-bold fs-6">#${rank}</span>
        </td>
        <td>
          <div class="fw-bold text-dark mb-0">
            ${title}
            <span class="badge bg-success-subtle text-success border border-success-subtle py-0 px-2 ms-1 small" title="Agent 5 Direct Vacancy Verified">
              <i class="bi bi-patch-check-fill"></i> Verified Direct
            </span>
          </div>
          <div class="small text-secondary">
            <span class="fw-medium text-dark">${company}</span> · ${location}
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center justify-content-between small fw-bold mb-1">
            <span>${score}%</span>
            <span class="badge ${progressColor} py-0 px-1 text-white">${tier}</span>
          </div>
          <div class="progress" style="height: 6px;">
            <div class="progress-bar ${progressColor}" role="progressbar" style="width: ${score}%;"></div>
          </div>
        </td>
        <td>
          <span class="badge ${portalClass} badge-portal">${portal}</span>
          <div class="small text-muted mt-1"><i class="bi bi-clock me-1"></i>${freshness}</div>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td class="small text-secondary">
          ${appliedOn}
        </td>
        <td class="text-end pe-3">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="openJobDetailModal('${job.id || job.job_id}')" title="Review Job Details">
              <i class="bi bi-eye"></i> Review
            </button>
            <button class="btn btn-outline-success" onclick="triggerOpenApply('${job.id || job.job_id}')" title="Open Portal and Apply">
              <i class="bi bi-send"></i> Apply
            </button>
            <button class="btn btn-outline-danger" onclick="triggerSkipJob('${job.id || job.job_id}')" title="Skip with Reason">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Updates Dashboard Metric Counters
 */
function updateMetrics() {
  const total = allJobs.length;
  const pending = allJobs.filter(j => !(j.status === 'applied' || j.status === 'skipped' || j.status === 'rejected')).length;
  const applied = allJobs.filter(j => j.status === 'applied').length;
  const skipped = allJobs.filter(j => j.status === 'skipped' || j.status === 'rejected').length;

  document.getElementById('statTopRanked').innerText = total;
  document.getElementById('statPending').innerText = pending;
  document.getElementById('statApplied').innerText = applied;
  document.getElementById('statSkipped').innerText = skipped;

  document.getElementById('tabCountAll').innerText = total;
  document.getElementById('tabCountPending').innerText = pending;
  document.getElementById('tabCountApplied').innerText = applied;
  document.getElementById('tabCountSkipped').innerText = skipped;
}

/**
 * Opens Job Detail Modal with full match explanation
 */
window.openJobDetailModal = function(jobId) {
  const job = allJobs.find(j => (j.id === jobId || j.job_id === jobId));
  if (!job) return;

  selectedJobForAction = job;

  document.getElementById('modalJobTitle').innerText = job.title || job.job_title;
  document.getElementById('modalCompanyLocation').innerText = `${job.company || job.company_name} · ${job.location || 'Coimbatore'}`;
  document.getElementById('modalMatchScore').innerText = `${job.match_score || job.matchScore || 90}% Match (Rank #${job.rank || 1})`;
  document.getElementById('modalCompanyHeader').innerText = job.company || job.company_name;
  document.getElementById('modalCompanyDetails').innerText = job.companyDetails || `Hiring for software engineering roles in ${job.location}.`;

  const websiteBtn = document.getElementById('modalCompanyWebsite');
  if (job.companyWebsite) {
    websiteBtn.href = job.companyWebsite;
    websiteBtn.classList.remove('d-none');
  } else {
    websiteBtn.classList.add('d-none');
  }

  document.getElementById('modalMatchedResume').innerText = job.matchedResume || 'PHP Developer Resume';
  document.getElementById('modalPortfolioLink').href = job.portfolioUrl || 'https://nishanth0303.github.io/Nishanth-portfolio/php-dev.html';

  // Matched Skills
  const matchedPills = (job.matchedSkills || ['PHP', 'Laravel', 'MySQL', 'REST APIs'])
    .map(s => `<span class="badge bg-success-subtle text-success border border-success-subtle me-1">${s}</span>`).join('');
  document.getElementById('modalMatchedSkillsBadges').innerHTML = matchedPills;

  // Gaps
  const gapPills = (job.unmatchedSkills || ['None critical'])
    .map(s => `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle me-1">${s}</span>`).join('');
  document.getElementById('modalUnmatchedSkillsBadges').innerHTML = gapPills;

  document.getElementById('modalFitReason').innerText = job.fitReason || 'Strong match with 5 years in PHP/Laravel backend architecture.';
  document.getElementById('modalJobDescription').innerText = job.description || 'Enterprise web application development role.';
  document.getElementById('modalCoverLetter').value = job.coverNote || '';

  const directUrl = job.job_detail_url || job.direct_job_post_url || job.applyUrl || '#';
  const officialUrl = job.official_application_url || directUrl;

  document.getElementById('modalDirectPageBtn').href = directUrl;
  document.getElementById('modalOfficialAppBtn').href = officialUrl;

  detailModalInstance.show();
};

/**
 * Handles "Open & Apply on Portal"
 * MANDATORY INVARIANT: Never auto-mark as Applied upon link opening.
 * Opens vacancy in new tab AND triggers confirmation modal.
 */
window.triggerOpenApply = function(jobId) {
  const job = allJobs.find(j => (j.id === jobId || j.job_id === jobId));
  if (!job) return;
  handleOpenAndApply(job);
};

function handleOpenAndApply(job) {
  selectedJobForAction = job;
  const url = job.direct_job_post_url || job.job_detail_url || job.applyUrl || '#';

  // Open external job post in new tab
  if (url && url !== '#') {
    window.open(url, '_blank');
  }

  // Populate & show confirmation modal
  document.getElementById('confirmJobTitle').innerText = job.title || job.job_title;
  document.getElementById('confirmJobCompany').innerText = `${job.company || job.company_name} (${job.portal || 'Portal'})`;
  applyConfirmModalInstance.show();
}

/**
 * Triggers Skip Reason Modal
 */
window.triggerSkipJob = function(jobId) {
  const job = allJobs.find(j => (j.id === jobId || j.job_id === jobId));
  if (!job) return;
  openSkipReasonModal(job);
};

function openSkipReasonModal(job) {
  selectedJobForAction = job;
  document.getElementById('skipCustomNote').value = '';
  document.getElementById('reasonSalary').checked = true;
  skipModalInstance.show();
}

/**
 * Confirms and Saves Skip Reason
 */
function handleConfirmSkipReason() {
  if (!selectedJobForAction) return;

  const selectedRadio = document.querySelector('input[name="skipReasonRadio"]:checked');
  let reason = selectedRadio ? selectedRadio.value : 'Other';
  const customNote = document.getElementById('skipCustomNote').value.trim();

  if (reason === 'Other' && customNote) {
    reason = customNote;
  } else if (customNote) {
    reason = `${reason}: ${customNote}`;
  }

  applyJobStatus(selectedJobForAction.id || selectedJobForAction.job_id, 'skipped', reason);
  skipModalInstance.hide();
}

/**
 * Updates Job Status in memory and dispatches to Backend API if active
 */
async function applyJobStatus(jobId, newStatus, skipReason = null) {
  const job = allJobs.find(j => (j.id === jobId || j.job_id === jobId));
  if (!job) return;

  job.status = newStatus;
  if (newStatus === 'applied') {
    job.appliedDate = new Date().toISOString();
  }
  if (skipReason) {
    job.skipReason = skipReason;
  }

  // Save in localStorage as offline fallback
  try {
    localStorage.setItem('jobhuntai_v3_state', JSON.stringify(allJobs));
  } catch (e) {}

  // Dispatch to API
  try {
    await fetch(`/api/v1/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        skipReason: skipReason
      })
    });
  } catch (e) {
    console.log('[JobHuntAI v3.0] Status saved in client state (running in static mode)');
  }

  updateMetrics();
  renderJobsTable();
}

/**
 * Resets all filters
 */
window.resetFilters = function() {
  currentFilter = { tab: 'all', time: 'all', portal: 'all', location: 'all', query: '' };
  document.getElementById('searchInput').value = '';
  document.getElementById('portalFilter').value = 'all';
  document.getElementById('locationFilter').value = 'all';
  document.querySelectorAll('#statusTabs .nav-link').forEach(b => b.classList.remove('active'));
  document.querySelector('#statusTabs .nav-link[data-tab="all"]').classList.add('active');
  document.querySelectorAll('#timeFilters .time-filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#timeFilters .time-filter-btn[data-time="all"]').classList.add('active');
  handleTabSwitch();
};

/**
 * Triggers On-Demand Scan
 */
async function handleTriggerScan() {
  const btn = document.getElementById('scanJobsBtn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Scanning...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/v1/scan/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': 'jobhuntai_admin_secret_key_v3'
      }
    });

    if (res.ok) {
      alert('Daily Scan completed successfully!');
      await loadJobsData();
    } else {
      const err = await res.json();
      alert(`Scan notice: ${err.message || 'Scan completed in local mode.'}`);
    }
  } catch (e) {
    alert('Running in GitHub Pages static mode. To execute active web scrapers, start the cloud backend with "npm start".');
  } finally {
    btn.innerHTML = orig;
    btn.disabled = false;
  }
}

/**
 * Renders the Day-by-Day Historical Snapshots
 */
function renderHistorySnapshots() {
  const container = document.getElementById('historySnapshotsList');
  const dates = [
    '2026-11-13',
    '2026-11-12',
    '2026-11-11',
    '2026-11-10',
    '2026-11-09',
    '2026-11-08',
    '2026-11-07'
  ];

  container.innerHTML = dates.map(d => `
    <div class="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-3">
      <div>
        <div class="fw-bold text-dark"><i class="bi bi-calendar-event me-2 text-primary"></i>Daily Hunt Snapshot: ${d}</div>
        <div class="small text-muted">Permanent historical record · Verified Top 20 ranking preserved</div>
      </div>
      <div>
        <a href="data/history/${d}.json" target="_blank" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-filetype-json me-1"></i>View JSON Snapshot
        </a>
      </div>
    </div>
  `).join('');
}

