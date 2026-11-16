/**
 * Integration Test 2: API Authentication & Authorization
 */
const assert = require('assert');
const { signJWT, verifyJWT } = require('../../backend/src/middleware/auth');

console.log('--- Running Test 2: API Authorization & JWT Test ---');

// 1. Sign a valid token
const payload = { userId: 'candidate-nishanth', role: 'candidate' };
const token = signJWT(payload, 'test_secret_123', 7);
assert.ok(token && token.split('.').length === 3, 'Must produce valid 3-part JWT');

// 2. Verify valid token
const verifyValid = verifyJWT(token, 'test_secret_123');
assert.strictEqual(verifyValid.valid, true);
assert.strictEqual(verifyValid.payload.userId, 'candidate-nishanth');
console.log('✓ Token signing and verification succeeded');

// 3. Reject tampered token
const tamperedToken = token.slice(0, -5) + 'abcde';
const verifyTampered = verifyJWT(tamperedToken, 'test_secret_123');
assert.strictEqual(verifyTampered.valid, false);
assert.strictEqual(verifyTampered.error, 'Invalid token signature');
console.log('✓ Tampered signature correctly rejected');

// 4. Reject token signed with different secret
const verifyWrongSecret = verifyJWT(token, 'different_secret_456');
assert.strictEqual(verifyWrongSecret.valid, false);
console.log('✓ Incorrect secret rejected');

// 5. Expired token rejection
const expiredToken = signJWT(payload, 'test_secret_123', -1); // expired 1 day ago
const verifyExpired = verifyJWT(expiredToken, 'test_secret_123');
assert.strictEqual(verifyExpired.valid, false);
assert.strictEqual(verifyExpired.error, 'Token has expired');
console.log('✓ Expired token correctly rejected');

console.log('✅ Test 2: API Authorization & JWT Test Passed!\n');

