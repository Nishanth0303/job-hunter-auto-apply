// State
let allJobs = [];
let currentFilter = 'all';
let currentJob = null;
let reviewModal = null;
let settingsModal = null;
let addJobModal = null;
let skipReasonModal = null;
let isGitHubPages = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';

document.addEventListener('DOMContentLoaded', () => {
  reviewModal = new bootstrap.Modal(document.getElementById('jobReviewModal'));
  settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
  addJobModal = new bootstrap.Modal(document.getElementById('addJobModal'));
  skipReasonModal = new bootstrap.Modal(document.getElementById('skipReasonModal'));

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
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-filter');
      applyFiltersAndRender();
    });
  });
});

async function loadJobs() {
  try {
    let jobsData = [];
    if (!isGitHubPages) {
      try {
        const res = await fetch('/api/jobs');
        if (res.ok) jobsData = await res.json();
      } catch (e) {
        console.warn('API error, falling back to static file:', e);
      }
    }

    if (!jobsData || jobsData.length === 0) {
      // Load static data/jobs.json
      const res = await fetch('data/jobs.json');
      jobsData = await res.json();
      
      // Merge with localStorage overrides if running on GitHub Pages
      const savedStatus = JSON.parse(localStorage.getItem('job_status_overrides') || '{}');
      jobsData.forEach(j => {
        if (savedStatus[j.id]) {
          j.status = savedStatus[j.id].status;
          j.appliedDate = savedStatus[j.id].appliedDate;
          j.skipReason = savedStatus[j.id].skipReason || j.skipReason;
        }
      });
    }

    // Sort descending by matchScore (Rank 1 to 20)
    jobsData.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
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
  let filtered = allJobs;

  if (currentFilter !== 'all') {
    filtered = filtered.filter(j => j.status === currentFilter);
  }

  if (search) {
    filtered = filtered.filter(j => 
      (j.title && j.title.toLowerCase().includes(search)) ||
      (j.company && j.company.toLowerCase().includes(search)) ||
      (j.location && j.location.toLowerCase().includes(search)) ||
      (j.source && j.source.toLowerCase().includes(search)) ||
      (j.skipReason && j.skipReason.toLowerCase().includes(search))
    );
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
          <div class="fw-bold text-dark fs-6">${escapeHtml(job.title)}</div>
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
          <small class="text-muted d-block mt-1">${formatTimeAgo(job.postedDate)}</small>
        </td>
        <td>${statusBadge}</td>
        <td>${appliedInfo}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="openReviewById('${job.id}')" title="Review Job Details">
              <i class="bi bi-eye me-1"></i>Review
            </button>
            ${isPending ? `
              <button class="btn btn-success" onclick="approveAndApply('${job.id}')" title="Approve & Auto-Apply">
                <i class="bi bi-send-check me-1"></i>Apply
              </button>
              <button class="btn btn-outline-danger" onclick="promptSkipReason('${job.id}')" title="Not Willing to Apply">
                <i class="bi bi-x-lg"></i>
              </button>
            ` : ''}
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

  const externalLink = document.getElementById('modalJobLink');
  if (job.applyUrl && job.applyUrl !== '#') {
    externalLink.href = job.applyUrl;
    externalLink.style.display = 'inline-flex';
  } else {
    externalLink.style.display = 'none';
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
  if (job.status === 'applied') {
    applyBtn.className = 'btn btn-secondary disabled';
    applyBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Already Applied';
    applyBtn.disabled = true;
  } else {
    applyBtn.className = 'btn btn-success';
    applyBtn.innerHTML = '<i class="bi bi-send-check me-1"></i>Approve & Auto-Apply';
    applyBtn.disabled = false;
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

async function approveAndApply(id) {
  const job = allJobs.find(j => j.id === id);
  if (!job) return;

  job.status = 'applied';
  job.appliedDate = new Date().toISOString();
  job.skipReason = null;

  // Save to localStorage
  const saved = JSON.parse(localStorage.getItem('job_status_overrides') || '{}');
  saved[id] = { status: 'applied', appliedDate: job.appliedDate, skipReason: null };
  localStorage.setItem('job_status_overrides', JSON.stringify(saved));

  if (!isGitHubPages) {
    try {
      await fetch(`/api/jobs/approve/${id}`, { method: 'POST' });
    } catch (e) {}
  }

  showToast(`Applied for ${job.title} at ${job.company}!`);
  updateStats();
  applyFiltersAndRender();
  renderDailyReportData();
}

async function approveAndApplyCurrent() {
  if (!currentJob) return;
  await approveAndApply(currentJob.id);
  reviewModal.hide();
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
