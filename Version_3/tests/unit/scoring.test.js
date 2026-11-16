/**
 * Unit Test: Agent 3 Candidate Relevance Scoring
 */
const assert = require('assert');
const agent3 = require('../../agents/agent3-scorer');

console.log('--- Running Agent 3 Relevance Scoring Tests ---');

// Test 1: Full-Stack React Role triggers Full Stack Resume variant
const reactJob = {
  title: 'Full Stack Developer (Laravel + React.js)',
  description: 'Looking for 5 years experienced full stack engineer with PHP, Laravel 10, MySQL, REST APIs, and React client components.',
  company: 'ModernStack',
  location: 'Coimbatore'
};

const reactResult = agent3.calculateRelevanceScore(reactJob);
assert.strictEqual(reactResult.recommendedResume, 'Full Stack Developer Resume');
assert.ok(reactResult.matchedSkills.includes('React'));
assert.ok(reactResult.score >= 88);
console.log('✓ Test 1 Passed: React role correctly selected Full Stack Resume variant');

// Test 2: Enterprise ERP Billing Role triggers Application Developer Resume variant
const erpJob = {
  title: 'ERP & Billing Software Developer',
  description: 'Enterprise ERP billing platform with multi-slab tax computation, invoicing, and MySQL optimization.',
  company: 'EnterpriseCorp',
  location: 'Coimbatore'
};

const erpResult = agent3.calculateRelevanceScore(erpJob);
assert.strictEqual(erpResult.recommendedResume, 'Application Developer Resume');
assert.ok(erpResult.matchedDomains.includes('ERP Systems'));
assert.ok(erpResult.matchedDomains.includes('Billing & Invoicing'));
console.log('✓ Test 2 Passed: ERP/Billing role correctly selected Application Developer Resume variant');

// Test 3: Sentence-level Explainable Fit Reason
assert.ok(typeof erpResult.explanation === 'string' && erpResult.explanation.length > 20);
assert.ok(erpResult.explanation.includes('Strong alignment with your 5 years'));
console.log('✓ Test 3 Passed: Score generated transparent sentence-level explanation');

// Test 4: Location Preference Scoring
const config = agent3.loadScoringConfig();
assert.strictEqual(agent3.evaluateLocation('Coimbatore, Tamil Nadu', config).score, 100);
assert.strictEqual(agent3.evaluateLocation('Remote (India)', config).score, 100);
assert.strictEqual(agent3.evaluateLocation('Chennai', config).score, 95);
assert.strictEqual(agent3.evaluateLocation('London, UK', config).score, 50);
console.log('✓ Test 4 Passed: Location scoring aligns with candidate preferences');

console.log('✅ All Scoring Unit Tests Passed!\n');
