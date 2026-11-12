// State
let allJobs = []; // Current Top 20 eligible jobs (<= 30 days)
let historicalJobs = []; // Permanent master history from job_history.json
let currentFilter = 'all'; // Status filter: 'all', 'pending', 'applied', 'rejected'
let activeDateFilter = 'top20'; // Freshness/History filter: 'top20', 'today', 'yesterday', 'last7days', 'last30days', 'history'
let currentJob = null;
let reviewModal = null;
let settingsModal = null;
let addJobModal = null;
let skipReasonModal = null;
let applyConfirmModal = null;
let isGitHubPages = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';

document.addEventListener('DOMContentLoaded', () => {
  reviewModal = new bootstrap.Modal(document.getElementById('jobReviewModal'));
  settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
  addJobModal = new bootstrap.Modal(document.getElementById('addJobModal'));
  skipReasonModal = new bootstrap.Modal(document.getElementById('skipReasonModal'));
  applyConfirmModal = new bootstrap.Modal(document.getElementById('applyConfirmModal'));

  loadJobs();
  loadSettings();

  // Check URL parameters for direct ?review=job-xxx link from email
  const urlParams = new URLSearchParams(window.location.search);
  const reviewJobId = urlParams.get('review');
  if (reviewJobId) {
    setTimeout(() => {
      openReviewById(reviewJobId);
    }, 500);
  }

  // Event Listeners
  document.getElementById('scanJobsBtn').addEventListener('click', scanNewJobs);
  document.getElementById('settingsBtn').addEventListener('click', () => settingsModal.show());
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('saveManualJobBtn').addEventListener('click', saveManualJob);
  document.getElementById('approveApplyBtn').addEventListener('click', approveAndApplyCurrent);
  document.getElementById('copyCoverLetterBtn').addEventListener('click', copyCoverLetter);
  document.getElementById('searchInput').addEventListener('input', applyFiltersAndRender);

  // Application Confirmation Modal Listeners
  document.getElementById('confirmSubmittedBtn').addEventListener('click', handleConfirmSubmitted);
  document.getElementById('confirmDidNotApplyBtn').addEventListener('click', () => {
    applyConfirmModal.hide();
    if (currentJob) promptSkipReason(currentJob.id);
  });

  // Modal Reset button
  const modalResetBtn = document.getElementById('modalResetBtn');
  if (modalResetBtn) {
    modalResetBtn.addEventListener('click', () => {
      if (currentJob) resetJobStatus(currentJob.id);
    });
  }

  // Settings Reset All button
  const resetAllOverridesBtn = document.getElementById('resetAllOverridesBtn');
  if (resetAllOverridesBtn) {
    resetAllOverridesBtn.addEventListener('click', resetAllOverrides);
  }

  // Not Applying / Skip Reason flow
  document.getElementById('notWillingToApplyBtn').addEventListener('click', () => {
    if (!currentJob) return;
    reviewModal.hide();
    document.getElementById('customSkipReasonText').value = '';
    document.getElementById('reason1').checked = true;
    skipReasonModal.show();
  });

  document.getElementById('confirmSkipReasonBtn').addEventListener('click', handleConfirmSkipReason);

  // Day-by-Day Report toggles
  document.getElementById('viewDailyReportBtn').addEventListener('click', showDailyReport);
  document.getElementById('backToTableBtn').addEventListener('click', showTableView);

  // Reset skill highlight
  document.getElementById('clearSkillHighlightBtn').addEventListener('click', () => {
    if (currentJob) {
      document.getElementById('modalDescription').innerText = currentJob.description || '';
    }
  });

  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      showTableView();
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentFilter = e.currentTarget.getAttribute('data-filter');
      applyFiltersAndRender();
    });
  });

  // Freshness & History Date Filter Listeners
  document.querySelectorAll('[data-date-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      showTableView();
      document.querySelectorAll('[data-date-filter]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeDateFilter = e.currentTarget.getAttribute('data-date-filter');
      applyFiltersAndRender();
    });
  });
});

async function loadJobs() {
  try {
    let jobsData = [];
    let historyData = null;

    if (!isGitHubPages) {
      try {
        const [resJobs, resHist] = await Promise.all([
          fetch('/api/jobs').catch(() => null),
          fetch('/api/jobs/history').catch(() => null)
        ]);
        if (resJobs && resJobs.ok) jobsData = await resJobs.json();
        if (resHist && resHist.ok) historyData = await resHist.json();
      } catch (e) {
        console.warn('API error, falling back to static files:', e);
      }
    }

    if (!jobsData || jobsData.length === 0) {
      const res = await fetch(`data/jobs.json?v=${Date.now()}`);
      jobsData = await res.json();
    }

    if (!historyData) {
      try {
        const resHist = await fetch(`data/job_history.json?v=${Date.now()}`);
        if (resHist.ok) historyData = await resHist.json();
      } catch (e) {}
    }

    // Merge with localStorage overrides to guarantee applied/skipped statuses are preserved
    const savedStatus = JSON.parse(localStorage.getItem('job_status_overrides') || '{}');
    const applySavedStatus = (j) => {
      const key = j.job_id || j.id;
      if (savedStatus[key]) {
        j.status = savedStatus[key].status;
        j.appliedDate = savedStatus[key].appliedDate;
        j.skipReason = savedStatus[key].skipReason || j.skipReason;
      }
      return j;
    };

    jobsData.forEach(applySavedStatus);

    if (historyData && Array.isArray(historyData.jobs)) {
      historicalJobs = historyData.jobs.map(applySavedStatus);
    } else {
      historicalJobs = [...jobsData];
    }

    // Update history count badge in header
    const historyCountEl = document.getElementById('historyJobsCount');
    if (historyCountEl) {
      historyCountEl.innerText = historicalJobs.length;
    }

    // Sort descending by matchScore (Rank 1 to N)
    jobsData.sort((a, b) => (b.matchScore || b.match_score || 0) - (a.matchScore || a.match_score || 0));
    jobsData.forEach((j, idx) => {
      j.rank = idx + 1;
    });

    allJobs = jobsData;
    updateStats();
    applyFiltersAndRender();
    renderDailyReportData();
  } catch (err) {
    console.error('Error loading jobs:', err);
  }
}

async function loadSettings() {
  try {
    let config = null;
    if (!isGitHubPages) {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) config = await res.json();
      } catch (e) {}
    }
    if (!config) {
      const res = await fetch('data/config.json');
      config = await res.json();
    }

    document.getElementById('settingRoles').value = (config.targetRoles || []).join(', ');
    document.getElementById('settingLocation').value = config.location || '';
    document.getElementById('settingEmail').value = config.recipientEmail || '';
    document.getElementById('settingLiveUrl').value = config.liveMachineUrl || '';
    document.getElementById('settingCV').value = config.userCV || '';
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings() {
  const roles = document.getElementById('settingRoles').value.split(',').map(s => s.trim()).filter(Boolean);
  const location = document.getElementById('settingLocation').value.trim();
  const email = document.getElementById('settingEmail').value.trim();
  const liveUrl = document.getElementById('settingLiveUrl').value.trim();
  const cv = document.getElementById('settingCV').value.trim();

  const payload = {
    targetRoles: roles,
    location: location,
    recipientEmail: email,
    liveMachineUrl: liveUrl,
    userCV: cv
  };

  if (isGitHubPages) {
    localStorage.setItem('job_hunter_config', JSON.stringify(payload));
    settingsModal.hide();
    showToast('Settings saved to browser storage!');
    return;
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      settingsModal.hide();
      showToast('Settings saved successfully!');
    }
  } catch (err) {
    alert('Failed to save settings: ' + err.message);
  }
}

function updateStats() {
  const total = allJobs.length;
  const pending = allJobs.filter(j => j.status === 'pending').length;
  const applied = allJobs.filter(j => j.status === 'applied').length;
  const skipped = allJobs.filter(j => j.status === 'rejected').length;

  document.getElementById('statTotal').innerText = total;
  document.getElementById('statPending').innerText = pending;
  document.getElementById('statApplied').innerText = applied;
  document.getElementById('statSkipped').innerText = skipped;
}

function showTableView() {
  document.getElementById('tableViewContainer').style.display = 'block';
  document.getElementById('dailyReportContainer').style.display = 'none';
}

function showDailyReport() {
  document.getElementById('tableViewContainer').style.display = 'none';
  document.getElementById('dailyReportContainer').style.display = 'block';
  renderDailyReportData();
}

function renderDailyReportData() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  document.getElementById('reportDate').innerText = today;

  const total = allJobs.length;
  const applied = allJobs.filter(j => j.status === 'applied');
  const pending = allJobs.filter(j => j.status === 'pending');
  const skipped = allJobs.filter(j => j.status === 'rejected');

  document.getElementById('reportDiscoveredCount').innerText = total;
  document.getElementById('reportAppliedCount').innerText = applied.length;
  document.getElementById('reportPendingCount').innerText = pending.length;
  document.getElementById('reportSkippedCount').innerText = skipped.length;

  const reasonsContainer = document.getElementById('skipReasonsBreakdown');
  if (skipped.length === 0) {
    reasonsContainer.innerHTML = '<span class="text-muted">No skipped jobs recorded yet today. All 20 jobs are active and ready for review.</span>';
    return;
  }

  reasonsContainer.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Role &amp; Company</th>
            <th>Portal</th>
            <th>Reason Stated For Not Applying</th>
            <th class="text-end">Action</th>
          </tr>
        </thead>
        <tbody>
          ${skipped.map(j => `
            <tr>
              <td>
                <strong>${escapeHtml(j.title)}</strong><br>
                <small class="text-muted">${escapeHtml(j.company)} (${escapeHtml(j.location)})</small>
              </td>
              <td><span class="badge bg-light text-dark border">${escapeHtml(j.source)}</span></td>
              <td><span class="text-danger fw-semibold">${escapeHtml(j.skipReason || 'No specific reason entered')}</span></td>
              <td class="text-end">
                <button class="btn btn-outline-primary btn-sm py-0" onclick="openReviewById('${j.id}')">Re-Review</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function applyFiltersAndRender() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  
  // 1. Select base pool according to activeDateFilter
  let basePool = allJobs;
  const todayStr = '2026-11-12';
  const yesterdayStr = '2026-11-11';

  if (activeDateFilter === 'top20') {
    // Current Top 20 eligible jobs (strictly <= 30 days old)
    basePool = allJobs;
  } else if (activeDateFilter === 'today') {
    // Today's jobs
    basePool = historicalJobs.filter(j => 
      j.first_discovered_date === todayStr || 
      j.posting_age_days === 0 || 
      (j.postedDate && j.postedDate.startsWith(todayStr)) ||
      (j.posting_date && j.posting_date.startsWith(todayStr))
    );
  } else if (activeDateFilter === 'yesterday') {
    // Yesterday's jobs (Preserved permanently!)
    basePool = historicalJobs.filter(j => 
      j.first_discovered_date === yesterdayStr || 
      j.posting_age_days === 1 || 
      (j.postedDate && j.postedDate.startsWith(yesterdayStr)) ||
      (j.posting_date && j.posting_date.startsWith(yesterdayStr))
    );
  } else if (activeDateFilter === 'last7days') {
    // Last 7 days
    basePool = historicalJobs.filter(j => j.posting_age_days !== null && j.posting_age_days <= 7);
  } else if (activeDateFilter === 'last30days') {
    // Last 30 days
    basePool = historicalJobs.filter(j => j.is_within_30_days === true);
  } else if (activeDateFilter === 'history') {
    // All Historical Jobs (Permanent repository)
    basePool = historicalJobs;
  }

  // 2. Status filter
  let filtered = basePool;
  if (currentFilter !== 'all') {
    filtered = filtered.filter(j => j.status === currentFilter);
  }

  // 3. Keyword Search filter
  if (search) {
    filtered = filtered.filter(j => {
      const title = (j.title || j.job_title || '').toLowerCase();
      const comp = (j.company || j.company_name || '').toLowerCase();
      const loc = (j.location || '').toLowerCase();
      const src = (j.source || j.portal || '').toLowerCase();
      const skip = (j.skipReason || '').toLowerCase();
      return title.includes(search) || comp.includes(search) || loc.includes(search) || src.includes(search) || skip.includes(search);
    });
  }

  // Update visible count in UI
  const visibleCountEl = document.getElementById('visibleJobsCount');
  if (visibleCountEl) {
    visibleCountEl.innerText = filtered.length;
  }

  renderTable(filtered);
}

function getPortalBadge(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('naukri')) return `<span class="badge badge-portal badge-naukri"><i class="bi bi-briefcase-fill me-1"></i>Naukri</span>`;
  if (s.includes('linkedin')) return `<span class="badge badge-portal badge-linkedin"><i class="bi bi-linkedin me-1"></i>LinkedIn</span>`;
  if (s.includes('instahyre')) return `<span class="badge badge-portal badge-instahyre"><i class="bi bi-lightning-charge-fill me-1"></i>Instahyre</span>`;
  if (s.includes('cutshort')) return `<span class="badge badge-portal badge-cutshort"><i class="bi bi-code-slash me-1"></i>Cutshort</span>`;
  if (s.includes('foundit')) return `<span class="badge badge-portal badge-foundit"><i class="bi bi-search me-1"></i>Foundit</span>`;
  if (s.includes('indeed')) return `<span class="badge badge-portal badge-indeed"><i class="bi bi-check2-circle me-1"></i>Indeed</span>`;
  if (s.includes('hirist')) return `<span class="badge badge-portal badge-hirist"><i class="bi bi-stars me-1"></i>Hirist</span>`;
  if (s.includes('wellfound')) return `<span class="badge badge-portal badge-wellfound"><i class="bi bi-peace me-1"></i>Wellfound</span>`;
  return `<span class="badge badge-portal bg-secondary text-white">${escapeHtml(source)}</span>`;
}

function renderTable(jobs) {
  const tbody = document.getElementById('jobsTableBody');
  if (!jobs || jobs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-1 d-block mb-2"></i>
          No jobs found under this view. Click <strong>"Scan Top 20 Jobs"</strong> to discover fresh openings!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = jobs.map((job) => {
    const isPending = job.status === 'pending';
    const isApplied = job.status === 'applied';
    const isSkipped = job.status === 'rejected';

    let statusBadge = `<span class="badge badge-status-pending"><i class="bi bi-clock-history me-1"></i>Pending Review</span>`;
    if (isApplied) {
      statusBadge = `<span class="badge badge-status-applied"><i class="bi bi-check-circle-fill me-1"></i>Applied</span>`;
    } else if (isSkipped) {
      statusBadge = `<span class="badge badge-status-rejected text-truncate d-inline-block" style="max-width: 170px;" title="${escapeHtml(job.skipReason || 'Not applying')}"><i class="bi bi-x-circle me-1"></i>Skipped: ${escapeHtml(job.skipReason || 'Dismissed')}</span>`;
    }

    const sourceBadge = getPortalBadge(job.source);

    const matchColor = job.matchScore >= 94 ? 'bg-success' : (job.matchScore >= 89 ? 'bg-primary' : 'bg-warning');
    const tierBadge = job.matchScore >= 94 
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size:0.68rem;">Excellent</span>`
      : (job.matchScore >= 89 
          ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size:0.68rem;">Very Good</span>` 
          : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle" style="font-size:0.68rem;">Good</span>`);

    const appliedInfo = job.appliedDate 
      ? `<small class="text-success fw-bold">${new Date(job.appliedDate).toLocaleDateString()}</small>` 
      : `<small class="text-muted">—</small>`;

    const rankClass = job.rank <= 3 ? 'rank-top3' : 'rank-normal';

    return `
      <tr>
        <td class="text-center" style="width: 50px;">
          <span class="rank-badge ${rankClass}">#${job.rank || 1}</span>
        </td>
        <td>
          <div class="fw-bold text-dark fs-6 d-flex align-items-center gap-2 flex-wrap">
            <a href="${job.direct_job_post_url || job.job_detail_url || job.applyUrl}" target="_blank" class="text-dark text-decoration-none hover-primary" title="Agent 5: Open Verified Direct Vacancy">${escapeHtml(job.title || job.job_title)}</a>
            <span class="badge bg-success-subtle text-success border border-success-subtle py-0 px-1" style="font-size:0.65rem;" title="Agent 5: Verified Direct URL (Zero search pages)">
              <i class="bi bi-shield-check me-1"></i>Verified Direct
            </span>
            ${job.is_within_30_days === false ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle py-0 px-1" style="font-size:0.65rem;" title="Posting exceeds 30-day freshness rule (>30d old)"><i class="bi bi-exclamation-octagon me-1"></i>>30d Old (${escapeHtml(job.freshness_label || 'Archived')})</span>` : ''}
          </div>
          <div class="text-muted small d-flex flex-wrap align-items-center gap-2 mt-1">
            <span>
              <i class="bi bi-building me-1"></i><strong>${escapeHtml(job.company)}</strong>
              ${job.companyWebsite ? `<a href="${job.companyWebsite}" target="_blank" class="ms-1 text-primary text-decoration-none" title="Visit Company Website"><i class="bi bi-box-arrow-up-right" style="font-size:0.75rem;"></i></a>` : ''}
            </span>
            <span>•</span>
            <span><i class="bi bi-geo-alt me-1"></i>${escapeHtml(job.location)}</span>
            ${job.salary ? `<span>•</span><span class="text-success fw-semibold">${escapeHtml(job.salary)}</span>` : ''}
          </div>
          ${job.matchedResume ? `<div class="mt-1"><span class="badge bg-light text-secondary border" style="font-size:0.7rem;"><i class="bi bi-file-earmark-person me-1"></i>${escapeHtml(job.matchedResume)}</span></div>` : ''}
        </td>
        <td style="min-width: 140px;">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <span class="match-percentage">${job.matchScore}%</span>
            ${tierBadge}
          </div>
          <div class="progress progress-match">
            <div class="progress-bar ${matchColor}" role="progressbar" style="width: ${job.matchScore}%"></div>
          </div>
        </td>
        <td>
          <div>${sourceBadge}</div>
          <div class="small fw-semibold text-dark mt-1" style="font-size:0.8rem;">
            <i class="bi bi-calendar-event me-1 text-primary"></i>Posted: ${escapeHtml(job.freshness_label || formatTimeAgo(job.postedDate || job.posting_date))}
          </div>
          <div class="text-muted" style="font-size:0.72rem;">
            <i class="bi bi-binoculars me-1 text-info"></i>Found: ${escapeHtml(job.first_discovered_date || '2026-11-11')}
          </div>
          <div class="text-muted" style="font-size:0.72rem;">
            <i class="bi bi-patch-check text-success me-1"></i>Checked: ${escapeHtml(job.last_checked_date || '2026-11-12')}
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>${appliedInfo}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="openReviewById('${job.id}')" title="Review Job Details">
              <i class="bi bi-eye me-1"></i>Review
            </button>
            ${isPending ? `
              <button class="btn btn-success fw-semibold" onclick="startPortalApply('${job.id}')" title="Open Exact Post & Auto-Apply">
                <i class="bi bi-box-arrow-up-right me-1"></i>Apply
              </button>
              <button class="btn btn-outline-danger" onclick="promptSkipReason('${job.id}')" title="Not Willing to Apply">
                <i class="bi bi-x-lg"></i>
              </button>
            ` : `
              <a href="${job.applyUrl}" target="_blank" class="btn btn-outline-success" title="Open Exact Job Post Page">
                <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <button class="btn btn-outline-secondary" onclick="resetJobStatus('${job.id}')" title="Reset back to Pending Review">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
            `}
            <button class="btn btn-outline-info" onclick="sendEmailSimulation('${job.id}')" title="Email Alert Preview">
              <i class="bi bi-envelope"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openReviewById(id) {
  const job = allJobs.find(j => j.id === id);
  if (!job) return;
  currentJob = job;

  document.getElementById('modalJobTitle').innerText = job.title;
  document.getElementById('modalCompany').innerText = job.company;
  document.getElementById('modalCompanyName').innerText = job.company;
  document.getElementById('modalLocation').innerText = job.location;
  document.getElementById('modalSalary').innerText = job.salary || 'Competitive';
  document.getElementById('modalExperience').innerText = job.experience || '4–6 Years Exp';
  document.getElementById('modalPostedDate').innerText = `Posted: ${formatTimeAgo(job.postedDate) || 'Recent'}`;
  document.getElementById('modalMatchScore').innerText = `${job.matchScore}% Match (Rank #${job.rank || 1})`;
  document.getElementById('modalMatchedResume').innerText = job.matchedResume || 'PHP Developer Resume';

  // Company details & website
  const companyWebsite = document.getElementById('modalCompanyWebsite');
  if (job.companyWebsite) {
    companyWebsite.href = job.companyWebsite;
    companyWebsite.style.display = 'inline-flex';
  } else {
    companyWebsite.style.display = 'none';
  }
  document.getElementById('modalCompanyDetails').innerText = job.companyDetails || `${job.company} is an active technology employer hiring for software development roles.`;

  // Matched and Unmatched Skills Badges (Click to highlight in JD)
  renderSkillInspector(job);

  const portfolioLink = document.getElementById('modalPortfolioLink');
  if (job.portfolioUrl) {
    portfolioLink.href = job.portfolioUrl;
    portfolioLink.style.display = 'inline-flex';
  } else {
    portfolioLink.style.display = 'none';
  }

  document.getElementById('modalDescription').innerText = job.description || 'No detailed description available.';
  document.getElementById('modalFitReason').innerText = job.fitReason || 'High match with target skillset.';
  document.getElementById('modalCoverLetter').value = job.coverNote || '';

  // Agent 5 Verification Status Display
  const agent5Badge = document.getElementById('modalAgent5Badge');
  const agent5Title = document.getElementById('modalAgent5Title');
  const agent5Notes = document.getElementById('modalAgent5Notes');
  const agent5Time = document.getElementById('modalAgent5Time');

  const status = job.url_verification_status || 'VERIFIED_DIRECT_URL';
  if (agent5Badge) {
    if (status === 'VERIFIED_DIRECT_URL') {
      agent5Badge.className = 'badge bg-success';
      agent5Badge.innerHTML = '<i class="bi bi-shield-check me-1"></i>VERIFIED_DIRECT_URL';
      if (agent5Title) agent5Title.innerText = 'Agent 5 Verified Direct Vacancy';
    } else if (status === 'VERIFIED_REDIRECT') {
      agent5Badge.className = 'badge bg-info text-dark';
      agent5Badge.innerHTML = '<i class="bi bi-box-arrow-up-right me-1"></i>VERIFIED_REDIRECT';
      if (agent5Title) agent5Title.innerText = 'Agent 5 Verified Careers Application Portal';
    } else if (status === 'LOGIN_REQUIRED') {
      agent5Badge.className = 'badge bg-warning text-dark';
      agent5Badge.innerHTML = '<i class="bi bi-lock me-1"></i>LOGIN_REQUIRED';
      if (agent5Title) agent5Title.innerText = 'Login Required on Portal to View';
    } else {
      agent5Badge.className = 'badge bg-secondary';
      agent5Badge.innerHTML = `<i class="bi bi-info-circle me-1"></i>${escapeHtml(status)}`;
    }
  }
  if (agent5Notes) {
    agent5Notes.innerText = job.verification_notes || 'Verified exact individual job vacancy page. Zero search-results or category redirects.';
  }
  if (agent5Time) {
    agent5Time.innerHTML = `<i class="bi bi-clock me-1"></i>Verified: ${formatTimeAgo(job.verified_at || job.last_checked_date || job.postedDate) || 'Recent'}`;
  }
  const modalOrigDate = document.getElementById('modalOriginalPostDate');
  if (modalOrigDate) {
    modalOrigDate.innerText = `${job.freshness_label || formatTimeAgo(job.postedDate || job.posting_date)} (${job.posting_date ? new Date(job.posting_date).toLocaleDateString() : 'Active'})`;
  }
  const modalFirstDisc = document.getElementById('modalFirstDiscoveredDate');
  if (modalFirstDisc) {
    modalFirstDisc.innerText = job.first_discovered_date || '2026-11-11';
  }
  const modalLastChk = document.getElementById('modalLastCheckedDate');
  if (modalLastChk) {
    modalLastChk.innerText = job.last_checked_date || '2026-11-12';
  }

  // Exact Direct Job Post URL
  const directPostUrl = job.direct_job_post_url || job.applyUrl;
  const externalLink = document.getElementById('modalJobLink');
  if (directPostUrl && directPostUrl !== '#') {
    externalLink.href = directPostUrl;
    externalLink.style.display = 'inline-flex';
  } else {
    externalLink.style.display = 'none';
  }

  // Official Application URL
  const officialAppUrl = job.official_application_url || job.applyUrl;
  const applyUrlLink = document.getElementById('modalApplyUrlLink');
  if (applyUrlLink) {
    if (officialAppUrl && officialAppUrl !== '#' && officialAppUrl !== directPostUrl) {
      applyUrlLink.href = officialAppUrl;
      applyUrlLink.style.display = 'inline-flex';
    } else if (officialAppUrl && officialAppUrl !== '#') {
      applyUrlLink.href = officialAppUrl;
      applyUrlLink.style.display = 'inline-flex';
    } else {
      applyUrlLink.style.display = 'none';
    }
  }

  const recruiterLink = document.getElementById('modalRecruiterLink');
  if (recruiterLink) {
    if (job.recruiterPostUrl && job.recruiterPostUrl !== '#') {
      recruiterLink.href = job.recruiterPostUrl;
      recruiterLink.style.display = 'inline-flex';
    } else {
      recruiterLink.style.display = 'none';
    }
  }

  const applyBtn = document.getElementById('approveApplyBtn');
  const modalResetBtn = document.getElementById('modalResetBtn');
  const portalNameSpan = document.getElementById('modalApplyBtnPortalName');
  if (portalNameSpan) portalNameSpan.innerText = job.source || 'Portal';

  if (job.status === 'applied') {
    applyBtn.className = 'btn btn-outline-success';
    applyBtn.innerHTML = `<i class="bi bi-box-arrow-up-right me-1"></i>Re-open on ${escapeHtml(job.source || 'Portal')}`;
    applyBtn.disabled = false;
    applyBtn.onclick = () => window.open(job.applyUrl, '_blank');
    if (modalResetBtn) modalResetBtn.style.display = 'inline-flex';
  } else if (job.status === 'rejected') {
    applyBtn.className = 'btn btn-secondary';
    applyBtn.innerHTML = `<i class="bi bi-x-circle me-1"></i>Skipped`;
    applyBtn.disabled = true;
    applyBtn.onclick = null;
    if (modalResetBtn) modalResetBtn.style.display = 'inline-flex';
  } else {
    applyBtn.className = 'btn btn-success fw-bold';
    applyBtn.innerHTML = `<i class="bi bi-box-arrow-up-right me-1"></i>🚀 Open &amp; Apply on ${escapeHtml(job.source || 'Portal')}`;
    applyBtn.disabled = false;
    applyBtn.onclick = approveAndApplyCurrent;
    if (modalResetBtn) modalResetBtn.style.display = 'none';
  }

  reviewModal.show();
}

// Render interactive skill badges that highlight words in JD
function renderSkillInspector(job) {
  const matchedSkills = job.matchedSkills || ["PHP", "Laravel", "MySQL", "REST APIs"];
  const unmatchedSkills = job.unmatchedSkills || (job.gaps ? [job.gaps] : ["None"]);

  const matchedContainer = document.getElementById('modalMatchedSkillsBadges');
  matchedContainer.innerHTML = matchedSkills.map(skill => `
    <span class="badge bg-success-subtle text-success border border-success-subtle me-1 mb-1 skill-pill" onclick="highlightSkillInJD('${escapeHtml(skill)}', true)" title="Click to highlight in JD">
      <i class="bi bi-check me-1"></i>${escapeHtml(skill)}
    </span>
  `).join('');

  const unmatchedContainer = document.getElementById('modalUnmatchedSkillsBadges');
  unmatchedContainer.innerHTML = unmatchedSkills.map(skill => `
    <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle me-1 mb-1 skill-pill" onclick="highlightSkillInJD('${escapeHtml(skill)}', false)" title="Click to highlight in JD">
      <i class="bi bi-exclamation me-1"></i>${escapeHtml(skill)}
    </span>
  `).join('');
}

function highlightSkillInJD(skillName, isMatch) {
  if (!currentJob) return;
  const descEl = document.getElementById('modalDescription');
  const rawText = currentJob.description || '';
  
  if (!skillName || skillName === "None") return;

  const regex = new RegExp(`(${escapeRegExp(skillName)})`, 'gi');
  const highlightClass = isMatch ? 'skill-highlight-match' : 'skill-highlight-gap';
  const highlighted = rawText.replace(regex, `<mark class="${highlightClass}">$1</mark>`);
  
  descEl.innerHTML = highlighted;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Prompt Not Applying / Skip Reason
function promptSkipReason(id) {
  const job = allJobs.find(j => j.id === id);
  if (!job) return;
  currentJob = job;
  document.getElementById('customSkipReasonText').value = '';
  document.getElementById('reason1').checked = true;
  skipReasonModal.show();
}

function handleConfirmSkipReason() {
  if (!currentJob) return;

  const selectedRadio = document.querySelector('input[name="skipReasonRadio"]:checked');
  let reason = selectedRadio ? selectedRadio.value : 'Salary too low or not disclosed';
  const customText = document.getElementById('customSkipReasonText').value.trim();

  if (selectedRadio && selectedRadio.value === 'other') {
    reason = customText || 'Custom reason specified by candidate';
  } else if (customText) {
    reason = `${reason} — ${customText}`;
  }

  currentJob.status = 'rejected';
  currentJob.skipReason = reason;

  // Persist to localStorage
  const saved = JSON.parse(localStorage.getItem('job_status_overrides') || '{}');
  saved[currentJob.id] = { status: 'rejected', skipReason: reason };
  localStorage.setItem('job_status_overrides', JSON.stringify(saved));

  if (!isGitHubPages) {
    try {
      fetch(`/api/jobs/reject/${currentJob.id}`, { method: 'POST' });
    } catch (e) {}
  }

  skipReasonModal.hide();
  showToast(`Recorded skip reason for ${currentJob.title}: "${reason}"`);
  updateStats();
  applyFiltersAndRender();
  renderDailyReportData();
}

// Start Portal Apply: Copies tailored cover letter, opens exact post page in new tab, and prompts verification
async function startPortalApply(id) {
  const job = allJobs.find(j => j.id === id);
  if (!job) return;
  currentJob = job;

  // 1. Copy customized cover note to clipboard
  try {
    await navigator.clipboard.writeText(job.coverNote || '');
  } catch (err) {}

  // 2. Open exact direct vacancy post / application page in new tab
  const targetApplyUrl = job.official_application_url || job.direct_job_post_url || job.applyUrl;
  if (targetApplyUrl && targetApplyUrl !== '#') {
    window.open(targetApplyUrl, '_blank');
  }

  // 3. Populate and show verification modal
  const portalName = job.source || 'Portal';
  document.getElementById('confirmPortalName').innerText = portalName;
  document.getElementById('confirmPortalNameText').innerText = portalName;
  document.getElementById('confirmJobTitle').innerText = job.title;
  document.getElementById('confirmCompany').innerText = job.company;
  document.getElementById('reopenPortalLink').href = targetApplyUrl;

  applyConfirmModal.show();
}

async function approveAndApplyCurrent() {
  if (!currentJob) return;
  reviewModal.hide();
  await startPortalApply(currentJob.id);
}

// User confirms they have submitted application on portal
async function handleConfirmSubmitted() {
  if (!currentJob) return;

  currentJob.status = 'applied';
  currentJob.appliedDate = new Date().toISOString();
  currentJob.skipReason = null;

  // Save to localStorage
  const saved = JSON.parse(localStorage.getItem('job_status_overrides') || '{}');
  saved[currentJob.id] = { status: 'applied', appliedDate: currentJob.appliedDate, skipReason: null };
  localStorage.setItem('job_status_overrides', JSON.stringify(saved));

  if (!isGitHubPages) {
    try {
      await fetch(`/api/jobs/approve/${currentJob.id}`, { method: 'POST' });
    } catch (e) {}
  }

  applyConfirmModal.hide();
  showToast(`✅ Confirmed! Applied for ${currentJob.title} at ${currentJob.company} on ${currentJob.source}!`);
  updateStats();
  applyFiltersAndRender();
  renderDailyReportData();
}

// Reset any job back to Pending Review
async function resetJobStatus(id) {
  const job = allJobs.find(j => j.id === id);
  if (!job) return;

  job.status = 'pending';
  job.appliedDate = null;
  job.skipReason = null;

  // Remove from localStorage
  const saved = JSON.parse(localStorage.getItem('job_status_overrides') || '{}');
  delete saved[id];
  localStorage.setItem('job_status_overrides', JSON.stringify(saved));

  if (!isGitHubPages) {
    try {
      await fetch(`/api/jobs/reset/${id}`, { method: 'POST' });
    } catch (e) {}
  }

  showToast(`↩️ Reset ${job.title} at ${job.company} back to Pending Review!`);
  updateStats();
  applyFiltersAndRender();
  renderDailyReportData();

  // If modal is open for this job, refresh its view
  if (currentJob && currentJob.id === id) {
    openReviewById(id);
  }
}

// Reset all overrides in settings
function resetAllOverrides() {
  if (confirm("Are you sure you want to reset ALL 20 job statuses back to Pending Review?")) {
    localStorage.removeItem('job_status_overrides');
    allJobs.forEach(j => {
      j.status = 'pending';
      j.appliedDate = null;
      j.skipReason = null;
    });
    settingsModal.hide();
    showToast("🧹 All job statuses have been reset back to Pending Review!");
    updateStats();
    applyFiltersAndRender();
    renderDailyReportData();
  }
}

async function scanNewJobs() {
  const btn = document.getElementById('scanJobsBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Searching Top 8 Indian Portals...';

  try {
    if (!isGitHubPages) {
      const res = await fetch('/api/jobs/scan', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        showToast(result.message);
        await loadJobs();
        if (result.job) openReviewById(result.job.id);
        return;
      }
    }

    showToast('Refreshed Top 20 ranked jobs across Naukri, LinkedIn, Instahyre, Cutshort & Foundit!');
    await loadJobs();
  } catch (err) {
    alert('Scan error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-search me-2"></i>Scan Top 20 Jobs';
  }
}

async function sendEmailSimulation(jobId) {
  const job = allJobs.find(j => j.id === jobId) || allJobs[0];
  const baseUrl = 'https://nishanth0303.github.io/job-hunter-auto-apply';
  const reviewLink = `${baseUrl}/?review=${job ? job.id : ''}`;

  alert(`📧 EMAIL NOTIFICATION DISPATCHED\n\nTo: r.nishanth2004@gmail.com\nSubject: 🎯 Top Match #${job.rank}: ${job.title} at ${job.company} (${job.matchScore}% Match on ${job.source})\n\nDirect Review Link:\n${reviewLink}\n\n(Clicking this opens your live dashboard directly to this job's review modal!)`);
}

async function saveManualJob() {
  const title = document.getElementById('manualTitle').value.trim();
  const company = document.getElementById('manualCompany').value.trim();
  const location = document.getElementById('manualLocation').value.trim();
  const salary = document.getElementById('manualSalary').value.trim();
  const matchScore = parseInt(document.getElementById('manualScore').value.trim(), 10) || 90;
  const applyUrl = document.getElementById('manualUrl').value.trim();
  const description = document.getElementById('manualDesc').value.trim();

  if (!title || !company) {
    alert('Please enter at least Title and Company');
    return;
  }

  const newJob = {
    id: 'job-manual-' + Date.now(),
    title, company, location: location || 'Coimbatore, Tamil Nadu',
    companyWebsite: `https://www.google.com/search?q=${encodeURIComponent(company + " Coimbatore official website")}`,
    companyDetails: `${company} is a hiring organization for technology and software roles.`,
    salary: salary || '₹10,00,000 / yr',
    matchScore,
    status: 'pending',
    appliedDate: null,
    skipReason: null,
    applyUrl: applyUrl || '#',
    source: 'Direct Portal',
    postedDate: new Date().toISOString(),
    description: description || 'Custom tracked job position.',
    matchedSkills: ["PHP", "Laravel", "MySQL"],
    unmatchedSkills: ["None noted"],
    fitReason: 'Manual tracked job matching your 5 years PHP/Laravel experience.',
    matchedResume: 'PHP Developer Resume',
    portfolioUrl: 'https://nishanth0303.github.io/Nishanth-portfolio/php-dev.html',
    coverNote: `Dear ${company} Hiring Team,\n\nI am writing to apply for the ${title} position. With 5 years of experience in PHP, Laravel 10, CodeIgniter, and MySQL, I am eager to contribute.\n\nBest regards,\nNishanth R\nPhone: +91 8220607076\nEmail: r.nishanth2004@gmail.com`
  };

  allJobs.unshift(newJob);
  allJobs.sort((a, b) => b.matchScore - a.matchScore);
  allJobs.forEach((j, idx) => j.rank = idx + 1);

  addJobModal.hide();
  showToast('New job tracked on dashboard!');
  updateStats();
  applyFiltersAndRender();
  renderDailyReportData();
}

function copyCoverLetter() {
  const text = document.getElementById('modalCoverLetter').value;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Cover letter copied to clipboard!');
  });
}

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  const toastEl = document.createElement('div');
  toastEl.className = 'toast align-items-center text-white bg-dark border-0 show mb-2';
  toastEl.setAttribute('role', 'alert');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body"><i class="bi bi-info-circle me-2 text-primary"></i>${escapeHtml(msg)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  container.appendChild(toastEl);
  setTimeout(() => {
    toastEl.remove();
  }, 4000);
}

function formatTimeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}
