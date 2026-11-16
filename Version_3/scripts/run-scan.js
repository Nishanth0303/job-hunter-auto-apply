#!/usr/bin/env node
/**
 * JobHuntAI Version 3.0 — Scheduled Daily Scan Runner
 * 
 * Usage:
 *   node scripts/run-scan.js [--date=YYYY-MM-DD] [--force]
 */

const path = require('path');
const dataService = require('../backend/src/services/dataService');
const backupService = require('../backend/src/services/backupService');
const sanitizer = require('../backend/src/services/sanitizer');
const historyManager = require('../agents/history-manager');

const args = process.argv.slice(2);
const dateArg = args.find(a => a.startsWith('--date='));
const scanDate = dateArg ? dateArg.split('=')[1] : new Date().toISOString().slice(0, 10);
const force = args.includes('--force');

console.log(`================================================================`);
console.log(`🎯 JobHuntAI V3.0 Daily Scan Execution`);
console.log(`📅 Target Scan Date: ${scanDate}`);
console.log(`================================================================`);

// 1. Concurrency Check
const lock = dataService.acquireLock('cli_scan');
if (!lock.acquired && !force) {
  console.error(`[Scan Aborted] ${lock.reason}`);
  process.exit(1);
}

try {
  // 2. Pre-scan Safety Backup
  console.log('[1/4] Creating pre-scan backup snapshot...');
  const backup = backupService.createBackup('pre-scan-cli');
  console.log(`      ✓ Backup created: ${backup.backupFile} (SHA-256: ${backup.checksum.slice(0, 12)}...)`);

  // 3. Execute Scan & History Merge
  console.log('[2/4] Executing Two-Stage Ingestion Pipeline & History Merge...');
  const result = historyManager.recordDailyScan([], scanDate);
  console.log(`      ✓ Total Tracked in History: ${result.totalTracked}`);
  console.log(`      ✓ Newly Added: ${result.newlyAdded}`);
  console.log(`      ✓ Updated Existing: ${result.updatedExisting}`);
  console.log(`      ✓ Eligible (<=30 Days): ${result.totalEligible30Days}`);
  console.log(`      ✓ Active Top 20 Selected: ${result.top20Jobs.length}`);

  // 4. Generate Sanitized Public Feed for GitHub Pages
  console.log('[3/4] Generating Privacy-Sanitized Public Feed for GitHub Pages...');
  const publicFeed = sanitizer.generatePublicFeed(result.top20Jobs);
  console.log(`      ✓ Sanitized ${publicFeed.count} jobs -> ${publicFeed.outputPath}`);

  // 5. Release Lock
  console.log('[4/4] Releasing Concurrency Lock...');
  dataService.releaseLock();

  console.log(`================================================================`);
  console.log(`✅ Daily Scan Completed Successfully!`);
  console.log(`================================================================`);
} catch (err) {
  dataService.releaseLock();
  console.error(`❌ [Scan Error] ${err.message}`);
  process.exit(1);
}

