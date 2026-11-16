/**
 * Integration Test 5: Historical Status & Custom Reason Preservation Test
 */
const assert = require('assert');
const historyManager = require('../../agents/history-manager');

console.log('--- Running Test 5: Historical Status Preservation Test ---');

// 1. Generate run-unique company & URL to prevent collision
const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const testCustomJobId = `preserve-test-${uniqueSuffix}`;

const seedJob = {
  id: testCustomJobId,
  job_id: testCustomJobId,
  title: `Senior PHP Architect ${uniqueSuffix}`,
  company: `PreserveTech Solutions ${uniqueSuffix}`,
  location: 'Coimbatore',
  posting_date: '2026-11-12T00:00:00.000Z',
  applyUrl: `https://www.linkedin.com/jobs/view/777${uniqueSuffix.replace(/\D/g, '').slice(-7)}/`,
  status: 'applied',
  appliedDate: '2026-11-13T10:00:00.000Z',
  skipReason: 'Already applied',
  userNotes: 'Applied through direct connection with VP of Engineering.'
};

// Insert into history
const scan1 = historyManager.recordDailyScan([seedJob], '2026-11-13');
assert.strictEqual(scan1.newlyAdded, 1, 'Seed job should be inserted as new');

// Verify initial status
let history = historyManager.loadJobHistory();
let found = history.jobs.find(j => j.job_id === testCustomJobId || j.id === testCustomJobId);
assert.ok(found, 'Seeded job must exist in history');
assert.strictEqual(found.status, 'applied');
assert.strictEqual(found.skipReason, 'Already applied');
assert.strictEqual(found.userNotes, 'Applied through direct connection with VP of Engineering.');
console.log('✓ Seeded job with status "applied" and custom notes confirmed in history');

// 2. Simulate automated daily scan re-discovering the same job with default raw status 'pending_review'
const rawRediscoveredJob = {
  id: testCustomJobId,
  job_id: testCustomJobId,
  title: `Senior PHP Architect ${uniqueSuffix} (Re-crawled)`,
  company: `PreserveTech Solutions ${uniqueSuffix}`,
  location: 'Coimbatore',
  posting_date: '2026-11-13T00:00:00.000Z',
  applyUrl: `https://www.linkedin.com/jobs/view/777${uniqueSuffix.replace(/\D/g, '').slice(-7)}/`,
  status: 'pending_review' // Scraper raw default!
};

// Execute re-scan
const scan2 = historyManager.recordDailyScan([rawRediscoveredJob], '2026-11-13');
assert.strictEqual(scan2.updatedExisting, 1, 'Re-scan should update existing record');

// 3. Verify status was NOT wiped or reset to pending!
history = historyManager.loadJobHistory();
found = history.jobs.find(j => j.job_id === testCustomJobId || j.id === testCustomJobId);

assert.strictEqual(found.status, 'applied', 'Status MUST remain "applied" despite raw scraper payload!');
assert.strictEqual(found.skipReason, 'Already applied', 'Skip reason MUST be preserved!');
assert.strictEqual(found.userNotes, 'Applied through direct connection with VP of Engineering.', 'User notes MUST be preserved!');

console.log('✓ Immutability confirmed: Automated scan did NOT wipe status "applied" or user notes');
console.log('✅ Test 5: Historical Status Preservation Test Passed!\n');
