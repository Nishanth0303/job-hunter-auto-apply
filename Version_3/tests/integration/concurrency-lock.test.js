/**
 * Integration Test 4: Concurrency Lock Management Test
 */
const assert = require('assert');
const dataService = require('../../backend/src/services/dataService');

console.log('--- Running Test 4: Concurrency Lock Management Test ---');

// Release any existing lock first
dataService.releaseLock();
assert.strictEqual(dataService.isLocked(), false);

// 1. Acquire primary lock
const lock1 = dataService.acquireLock('worker_process_a');
assert.strictEqual(lock1.acquired, true, 'Primary lock should be successfully acquired');
assert.strictEqual(dataService.isLocked(), true, 'isLocked() should return true');

// 2. Secondary lock attempt must be REJECTED while primary is active
const lock2 = dataService.acquireLock('worker_process_b');
assert.strictEqual(lock2.acquired, false, 'Simultaneous lock attempt must be rejected');
assert.ok(lock2.reason.includes('Lock held by process'), 'Must report active holding process');
console.log('✓ Concurrency protection confirmed: Secondary write blocked with active lock');

// 3. Release lock
dataService.releaseLock();
assert.strictEqual(dataService.isLocked(), false, 'isLocked() should return false after release');

// 4. Acquisition succeeds after release
const lock3 = dataService.acquireLock('worker_process_c');
assert.strictEqual(lock3.acquired, true, 'Lock re-acquisition must succeed after release');
dataService.releaseLock();

console.log('✅ Test 4: Concurrency Lock Management Test Passed!\n');

