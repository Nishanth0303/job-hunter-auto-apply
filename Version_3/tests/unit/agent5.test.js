/**
 * Unit Test: Agent 5 URL Verifier
 */
const assert = require('assert');
const agent5 = require('../../agents/agent5-verifier');

console.log('--- Running Agent 5 URL Verifier Tests ---');

// Test 1: Reject Search URLs
const searchUrls = [
  'https://www.naukri.com/php-developer-jobs-in-coimbatore',
  'https://www.linkedin.com/jobs/search/?keywords=PHP+Developer&location=Chennai',
  'https://cloudi5.com/careers#open-roles',
  'https://cutshort.io/jobs/php-laravel-symfony-jobs-in-chennai',
  'https://www.foundit.in/search/php-jobs'
];

searchUrls.forEach(url => {
  const analysis = agent5.analyzeUrlStructure(url);
  assert.strictEqual(analysis.isSearch, true, `URL should be identified as search: ${url}`);
  assert.strictEqual(analysis.isIndividual, false, `URL should NOT be individual: ${url}`);
  
  const report = agent5.verifyJobVacancy({ applyUrl: url, company: 'TestCo', title: 'PHP Dev' });
  assert.strictEqual(report.url_verification_status, agent5.STATUS.SEARCH_PAGE_ONLY, `Status must be SEARCH_PAGE_ONLY for: ${url}`);
});
console.log('✓ Test 1 Passed: Successfully rejected search and category URLs');

// Test 2: Accept Direct Vacancy URLs
const directUrls = [
  'https://www.linkedin.com/jobs/view/4414379439/',
  'https://www.naukri.com/job-listings-senior-laravel-developer-kovaion-systems-12345',
  'https://cutshort.io/job/senior-php-developer-bangalore-abcde',
  'https://www.hirist.tech/j/php-developer-laravel-codeigniter-1637097?jobPos=3',
  'https://wellfound.com/jobs/4092860-laravel-developer?job_listing_slug=laravel-developer'
];

directUrls.forEach(url => {
  const analysis = agent5.analyzeUrlStructure(url);
  assert.strictEqual(analysis.isSearch, false, `URL must NOT be search: ${url}`);
  assert.strictEqual(analysis.isIndividual, true, `URL must be individual: ${url}`);

  const report = agent5.verifyJobVacancy({ applyUrl: url, company: 'TestCo', title: 'PHP Dev' });
  assert.strictEqual(report.url_verification_status, agent5.STATUS.VERIFIED_DIRECT_URL, `Status must be VERIFIED_DIRECT_URL for: ${url}`);
});
console.log('✓ Test 2 Passed: Successfully verified direct vacancy URLs for all major portals');

// Test 3: Handle Missing URL
const emptyReport = agent5.verifyJobVacancy({ applyUrl: '', company: 'EmptyCo', title: 'PHP Dev' });
assert.strictEqual(emptyReport.url_verification_status, agent5.STATUS.JOB_NOT_FOUND);
console.log('✓ Test 3 Passed: Successfully flagged missing URL as JOB_NOT_FOUND');

console.log('✅ All Agent 5 Unit Tests Passed!\n');

