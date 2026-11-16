#!/usr/bin/env node
/**
 * JobHuntAI Version 3.0 — Master Automated Test Suite Runner
 * 
 * Executes all Unit and Integration Tests:
 * 1. Agent 5 URL Verifier Tests
 * 2. Two-Stage Eligibility Pipeline Tests
 * 3. Candidate Relevance Scoring Tests
 * 4. Cloud Backend Availability Tests
 * 5. API Authorization & JWT Security Tests
 * 6. Duplicate Scan Idempotency Tests
 * 7. Concurrency Lock Management Tests
 * 8. Historical Data & Custom Status Preservation Tests
 */

const { execSync } = require('child_process');
const path = require('path');

const TESTS = [
  { name: 'Unit: Agent 5 URL Verifier', file: 'unit/agent5.test.js' },
  { name: 'Unit: Two-Stage Eligibility Pipeline', file: 'unit/eligibility.test.js' },
  { name: 'Unit: Candidate Relevance Scoring', file: 'unit/scoring.test.js' },
  { name: 'Integration: API Auth & JWT Security', file: 'integration/api-auth.test.js' },
  { name: 'Integration: Duplicate Scan Idempotency', file: 'integration/scan-idempotency.test.js' },
  { name: 'Integration: Concurrency Lock Management', file: 'integration/concurrency-lock.test.js' },
  { name: 'Integration: Historical Status Preservation', file: 'integration/history-preservation.test.js' },
  { name: 'Integration: Cloud Backend Availability', file: 'integration/backend-availability.test.js' }
];

console.log('================================================================');
console.log('🧪 JobHuntAI Version 3.0 — Automated Test Suite Execution');
console.log('================================================================\n');

let passed = 0;
let failed = 0;
const results = [];

TESTS.forEach(test => {
  const filePath = path.join(__dirname, test.file);
  console.log(`▶ Running: ${test.name}...`);
  try {
    const output = execSync(`node "${filePath}"`, { stdio: 'pipe' }).toString();
    console.log(output);
    passed++;
    results.push({ name: test.name, status: 'PASSED' });
  } catch (err) {
    console.error(`❌ FAILED: ${test.name}`);
    console.error(err.stdout ? err.stdout.toString() : err.message);
    failed++;
    results.push({ name: test.name, status: 'FAILED', error: err.message });
  }
});

console.log('================================================================');
console.log(`📊 TEST SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('================================================================');
results.forEach(r => {
  const icon = r.status === 'PASSED' ? '✓' : '✗';
  console.log(`  ${icon} [${r.status}] ${r.name}`);
});
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL AUTOMATED TESTS PASSED 100%!\n');
  process.exit(0);
}

