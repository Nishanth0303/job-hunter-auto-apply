// State
let allJobs = [];
let currentFilter = 'all';
let currentJob = null;
let reviewModal = null;
let settingsModal = null;
let addJobModal = null;

document.addEventListener('DOMContentLoaded', () => {
  reviewModal = new bootstrap.Modal(document.getElementById('jobReviewModal'));
  settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
  addJobModal = new bootstrap.Modal(document.getElementById('addJobModal'));

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

  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-filter');
      applyFiltersAndRender();
    });
  });
});

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    allJobs = await res.json();
    updateStats();
    applyFiltersAndRender();
  } catch (err) {
    console.error('Error loading jobs:', err);
  }
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const config = await res.json();
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

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRoles: roles,
        location: location,
        recipientEmail: email,
        liveMachineUrl: liveUrl,
        userCV: cv
      })
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
  const avgMatch = total ? Math.round(allJobs.reduce((acc, j) => acc + (j.matchScore || 0), 0) / total) : 0;

  document.getElementById('statTotal').innerText = total;
  document.getElementById('statPending').innerText = pending;
  document.getElementById('statApplied').innerText = applied;
  document.getElementById('statAvgMatch').innerText = avgMatch + '%';
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
      (j.location && j.location.toLowerCase().includes(search))
    );
  }

  renderTable(filtered);
}

function renderTable(jobs) {
  const tbody = document.getElementById('jobsTableBody');
  if (!jobs || jobs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-1 d-block mb-2"></i>
          No jobs found under this view. Click <strong>"Scan Fresh Jobs"</strong> to discover new roles!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = jobs.map((job, idx) => {
    const isPending = job.status === 'pending';
    const isApplied = job.status === 'applied';

    let statusBadge = `<span class="badge badge-status-pending"><i class="bi bi-clock-history me-1"></i>Pending Review</span>`;
    if (isApplied) {
      statusBadge = `<span class="badge badge-status-applied"><i class="bi bi-check-circle-fill me-1"></i>Applied</span>`;
    } else if (job.status === 'rejected') {
      statusBadge = `<span class="badge badge-status-rejected"><i class="bi bi-slash-circle me-1"></i>Dismissed</span>`;
    }

    const sourceBadge = job.source === 'LinkedIn' 
      ? `<span class="badge badge-source badge-linkedin"><i class="bi bi-linkedin me-1"></i>LinkedIn</span>`
      : `<span class="badge badge-source badge-indeed"><i class="bi bi-briefcase-fill me-1"></i>Indeed</span>`;

    const matchColor = job.matchScore >= 94 ? 'bg-success' : (job.matchScore >= 89 ? 'bg-primary' : 'bg-warning');
    const tierBadge = job.matchScore >= 94 
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size:0.68rem;">Excellent</span>`
      : (job.matchScore >= 89 
          ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size:0.68rem;">Very Good</span>` 
          : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle" style="font-size:0.68rem;">Good</span>`);

    const appliedInfo = job.appliedDate 
      ? `<small class="text-success fw-bold">${new Date(job.appliedDate).toLocaleDateString()}</small>` 
      : `<small class="text-muted">—</small>`;

    return `
      <tr>
        <td>
          <div class="fw-bold text-dark fs-6">${escapeHtml(job.title)}</div>
          <div class="text-muted small d-flex align-items-center gap-2 mt-1">
            <span><i class="bi bi-building me-1"></i>${escapeHtml(job.company)}</span>
            <span>•</span>
            <span><i class="bi bi-geo-alt me-1"></i>${escapeHtml(job.location)}</span>
            ${job.salary ? `<span>•</span><span class="text-success fw-semibold">${escapeHtml(job.salary)}</span>` : ''}
          </div>
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
              <button class="btn btn-outline-secondary" onclick="dismissJob('${job.id}')" title="Dismiss">
                <i class="bi bi-x-lg"></i>
              </button>
            ` : ''}
            <button class="btn btn-outline-info" onclick="sendEmailSimulation('${job.id}')" title="Send Email Alert Test">
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
  document.getElementById('modalLocation').innerText = job.location;
  document.getElementById('modalSalary').innerText = job.salary || 'Competitive';
  document.getElementById('modalMatchScore').innerText = `${job.matchScore}% Match`;
  document.getElementById('modalDescription').innerText = job.description || 'No detailed description available.';
  document.getElementById('modalFitReason').innerText = job.fitReason || 'High match with target skillset.';
  document.getElementById('modalGaps').innerText = job.gaps || 'None significant.';
  document.getElementById('modalCoverLetter').value = job.coverNote || '';

  const externalLink = document.getElementById('modalJobLink');
  if (job.applyUrl && job.applyUrl !== '#') {
    externalLink.href = job.applyUrl;
    externalLink.style.display = 'inline-flex';
  } else {
    externalLink.style.display = 'none';
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

async function approveAndApply(id) {
  try {
    const res = await fetch(`/api/jobs/approve/${id}`, { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      showToast(result.message);
      loadJobs();
    }
  } catch (err) {
    alert('Error applying: ' + err.message);
  }
}

async function approveAndApplyCurrent() {
  if (!currentJob) return;
  await approveAndApply(currentJob.id);
  reviewModal.hide();
}

async function dismissJob(id) {
  if (!confirm('Dismiss this job listing?')) return;
  try {
    const res = await fetch(`/api/jobs/reject/${id}`, { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      showToast(result.message);
      loadJobs();
    }
  } catch (err) {
    alert('Error dismissing: ' + err.message);
  }
}

async function scanNewJobs() {
  const btn = document.getElementById('scanJobsBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Searching LinkedIn & Indeed...';

  try {
    const res = await fetch('/api/jobs/scan', { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      showToast(result.message);
      await loadJobs();
      // Offer to review the newly found job immediately
      if (result.job) {
        openReviewById(result.job.id);
      }
    }
  } catch (err) {
    alert('Scan error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-search me-2"></i>Scan Fresh Jobs Now';
  }
}

async function sendEmailSimulation(jobId) {
  try {
    const res = await fetch('/api/notify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    const result = await res.json();
    if (result.success) {
      const p = result.emailPayload;
      alert(`📧 EMAIL DISPATCH NOTIFICATION\n\nTo: ${p.to}\nSubject: ${p.subject}\n\nMagic Direct Review Link:\n${p.magicReviewLink}\n\n(Clicking this link from an email opens this machine or live server directly to that job's review modal!)`);
    }
  } catch (err) {
    alert('Email test error: ' + err.message);
  }
}

async function saveManualJob() {
  const title = document.getElementById('manualTitle').value.trim();
  const company = document.getElementById('manualCompany').value.trim();
  const location = document.getElementById('manualLocation').value.trim();
  const salary = document.getElementById('manualSalary').value.trim();
  const matchScore = document.getElementById('manualScore').value.trim();
  const applyUrl = document.getElementById('manualUrl').value.trim();
  const description = document.getElementById('manualDesc').value.trim();

  if (!title || !company) {
    alert('Please enter at least Title and Company');
    return;
  }

  try {
    const res = await fetch('/api/jobs/manual-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, company, location, salary, matchScore, applyUrl, description
      })
    });
    const result = await res.json();
    if (result.success) {
      addJobModal.hide();
      showToast('New job added to dashboard!');
      loadJobs();
    }
  } catch (err) {
    alert('Error adding job: ' + err.message);
  }
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
