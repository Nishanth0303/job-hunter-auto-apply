#!/usr/bin/env node
/**
 * JobHuntAI Version 3.0 — Backup and Disaster Recovery Utility
 * 
 * Usage:
 *   node scripts/backup-restore.js --backup [--tag=mytag]
 *   node scripts/backup-restore.js --list
 *   node scripts/backup-restore.js --restore=<backup-filename>
 */

const backupService = require('../backend/src/services/backupService');

const args = process.argv.slice(2);

if (args.includes('--list')) {
  const backups = backupService.listBackups();
  console.log(`[Backup Utility] Found ${backups.length} snapshots:`);
  backups.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.filename} (${Math.round(b.sizeBytes / 1024)} KB) - ${b.createdAt} [SHA: ${b.checksum ? b.checksum.slice(0, 8) : 'none'}]`);
  });
  process.exit(0);
}

if (args.includes('--backup')) {
  const tagArg = args.find(a => a.startsWith('--tag='));
  const tag = tagArg ? tagArg.split('=')[1] : 'manual';
  console.log(`[Backup Utility] Creating snapshot with tag: ${tag}...`);
  const res = backupService.createBackup(tag);
  if (res.success) {
    console.log(`✓ Backup created successfully: ${res.backupFile}`);
    console.log(`✓ SHA-256 Checksum: ${res.checksum}`);
  } else {
    console.error(`❌ Backup failed: ${res.error}`);
    process.exit(1);
  }
  process.exit(0);
}

const restoreArg = args.find(a => a.startsWith('--restore='));
if (restoreArg) {
  const filename = restoreArg.split('=')[1];
  console.log(`[Backup Utility] Restoring from snapshot: ${filename}...`);
  const res = backupService.restoreBackup(filename);
  if (res.success) {
    console.log(`✓ Restored successfully from: ${res.restoredFrom}`);
    console.log(`✓ Timestamp: ${res.restoredAt}`);
  } else {
    console.error(`❌ Restore failed: ${res.error}`);
    process.exit(1);
  }
  process.exit(0);
}

console.log('Usage:');
console.log('  node scripts/backup-restore.js --backup [--tag=name]');
console.log('  node scripts/backup-restore.js --list');
console.log('  node scripts/backup-restore.js --restore=<filename>');

