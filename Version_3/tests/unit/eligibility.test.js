/**
 * Unit Test: Two-Stage Eligibility Pipeline
 */
const assert = require('assert');
const pipeline = require('../../agents/eligibility-pipeline');
const agent5 = require('../../agents/agent5-verifier');

console.log('--- Running Two-Stage Eligibility Pipeline Tests ---');

const scanDate = '2026-11-13';

// Test 1: Stale posting (>30 days) must be DISQUALIFIED from Top 20
const staleJob = {
  id: 'job-stale-01',
  title: 'PHP Developer',
  company: 'OldCo',
  location: 'Chennai',
  posting_date: '2026-05-12T00:00:00.000Z', // 6 months ago (185 days)
  applyUrl: 'https://www.linkedin.com/jobs/view/4414379439/'
};

const staleCheck = pipeline.checkEligibility(staleJob, scanDate);
assert.strictEqual(staleCheck.isEligible, false, 'Stale job (>30 days) must be ineligible');
assert.strictEqual(staleCheck.freshness.is_within_30_days, false);
assert.ok(staleCheck.disqualificationReason.includes('Stale posting'), 'Must explain stale disqualification');
console.log('✓ Test 1 Passed: 6-month-old posting correctly disqualified from Top 20');

// Test 2: Unknown posting date must be DISQUALIFIED from Top 20
const unknownDateJob = {
  id: 'job-unknown-date',
  title: 'Laravel Backend Dev',
  company: 'MysteryCo',
  location: 'Coimbatore',
  posting_date: 'UNKNOWN',
  applyUrl: 'https://www.linkedin.com/jobs/view/9999999999/'
};

const unknownCheck = pipeline.checkEligibility(unknownDateJob, scanDate);
assert.strictEqual(unknownCheck.isEligible, false, 'Unknown posting date must be ineligible for Top 20');
assert.ok(unknownCheck.disqualificationReason.includes('UNKNOWN'));
console.log('✓ Test 2 Passed: Unknown posting date correctly excluded from verified Top 20');

// Test 3: Search page URL must be DISQUALIFIED even if posted today
const searchUrlJob = {
  id: 'job-search-url',
  title: 'Senior PHP Engineer',
  company: 'SearchCo',
  location: 'Coimbatore',
  posting_date: '2026-11-13T00:00:00.000Z', // Today!
  applyUrl: 'https://www.naukri.com/php-developer-jobs-in-coimbatore' // Search URL!
};

const searchCheck = pipeline.checkEligibility(searchUrlJob, scanDate);
assert.strictEqual(searchCheck.isEligible, false, 'Search page URL must be disqualified regardless of freshness');
assert.ok(searchCheck.disqualificationReason.includes('Agent 5 blocked'));
console.log('✓ Test 3 Passed: Search page URL barred from Top 20 despite fresh posting date');

// Test 4: Fresh direct vacancy (posted 2 days ago) must PASS eligibility gate
const freshValidJob = {
  id: 'job-fresh-valid',
  title: 'Laravel & PHP Backend Developer',
  description: 'Looking for 4-6 years experienced Laravel & PHP developer with MySQL and REST APIs expertise in ERP systems.',
  company: 'Vibrant Tech',
  location: 'Coimbatore',
  posting_date: '2026-11-11T00:00:00.000Z', // 2 days ago
  applyUrl: 'https://www.linkedin.com/jobs/view/1122334455/'
};

const freshCheck = pipeline.checkEligibility(freshValidJob, scanDate);
assert.strictEqual(freshCheck.isEligible, true, 'Fresh direct job must be eligible');
assert.strictEqual(freshCheck.freshness.is_within_30_days, true);
assert.strictEqual(freshCheck.freshness.posting_age_days, 2);
console.log('✓ Test 4 Passed: Fresh direct vacancy successfully passed Stage 1 eligibility gate');

// Test 5: Complete Pipeline Batch Evaluation
const testBatch = [staleJob, unknownDateJob, searchUrlJob, freshValidJob];
const batchResult = pipeline.processEligibilityPipeline(testBatch, scanDate);

assert.strictEqual(batchResult.top20.length, 1, 'Only the single eligible job should be in Top 20');
assert.strictEqual(batchResult.archivedCount, 3, 'All 3 ineligible jobs must be archived');
assert.strictEqual(batchResult.top20[0].id, 'job-fresh-valid');
assert.ok(batchResult.top20[0].match_score >= 80, 'Must have calculated pure relevance score');
console.log('✓ Test 5 Passed: Full batch pipeline correctly isolated eligible jobs and computed relevance');

console.log('✅ All Eligibility Pipeline Tests Passed!\n');
