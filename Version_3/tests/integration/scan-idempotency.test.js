/**
 * Integration Test 3: Duplicate Scan Idempotency Test
 */
const assert = require('assert');
const historyManager = require('../../agents/history-manager');

console.log('--- Running Test 3: Duplicate Scan Idempotency Test ---');

const initialHistory = historyManager.loadJobHistory();
const initialCount = initialHistory.total_jobs_tracked;

// Use run-unique identifiers
const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const testJob = {
  id: `idemp-job-${uniqueSuffix}`,
  job_id: `idemp-job-${uniqueSuffix}`,
  title: `Senior Laravel Architect ${uniqueSuffix}`,
  company: `IdempotentTech ${uniqueSuffix}`,
  location: 'Coimbatore',
  posting_date: '2026-11-12T00:00:00.000Z',
  applyUrl: `https://www.linkedin.com/jobs/view/987${uniqueSuffix.replace(/\D/g, '').slice(-7)}/`
};

// First Scan
const run1 = historyManager.recordDailyScan([testJob], '2026-11-13');
assert.strictEqual(run1.newlyAdded, 1, 'First run should insert new job');

// Second Scan with IDENTICAL Job
const run2 = historyManager.recordDailyScan([testJob], '2026-11-13');
assert.strictEqual(run2.newlyAdded, 0, 'Second run must NOT create duplicate');
assert.strictEqual(run2.updatedExisting, 1, 'Second run should update existing record');

// Verify total count increased by exactly 1
const finalHistory = historyManager.loadJobHistory();
assert.strictEqual(finalHistory.total_jobs_tracked, initialCount + 1, 'Total jobs tracked must increase by exactly 1');

console.log('✓ Idempotency confirmed: Re-scanning identical vacancy generated 0 duplicate records');
console.log('✅ Test 3: Duplicate Scan Idempotency Test Passed!\n');
