/**
 * Integration Test 1: Cloud Backend Availability & Health Probe
 */
const assert = require('assert');
const http = require('http');
const app = require('../../backend/src/server');

console.log('--- Running Test 1: Cloud Backend Availability Test ---');

const testServer = http.createServer(app);

testServer.listen(0, () => {
  const port = testServer.address().port;

  http.get(`http://localhost:${port}/health`, (res) => {
    assert.strictEqual(res.statusCode, 200, 'Health endpoint must return HTTP 200');

    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      const data = JSON.parse(raw);
      assert.strictEqual(data.status, 'healthy');
      assert.strictEqual(data.version, '3.0.0');
      assert.ok(typeof data.uptime === 'number');
      assert.ok(data.timestamp);

      console.log('✓ Health check probe succeeded: HTTP 200 OK');
      console.log(`  Payload: status="${data.status}", version="${data.version}", uptime=${data.uptime}s`);

      testServer.close(() => {
        console.log('✅ Test 1: Backend Availability Test Passed!\n');
      });
    });
  }).on('error', (err) => {
    testServer.close();
    assert.fail(`Health probe failed: ${err.message}`);
  });
});

