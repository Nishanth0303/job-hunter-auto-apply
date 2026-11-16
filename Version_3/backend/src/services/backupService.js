const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

/**
 * Calculates SHA-256 checksum of a file
 */
function calculateChecksum(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Creates a timestamped backup with SHA-256 checksum
 */
function createBackup(customTag = '') {
  const sourceFile = config.paths.historyFile;
  if (!fs.existsSync(sourceFile)) {
    return { success: false, error: 'Source file does not exist' };
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = customTag 
    ? `job_history_${timestamp}_${customTag}.json` 
    : `job_history_${timestamp}.json`;
  
  const destPath = path.join(config.paths.backupDir, filename);
  const checksumPath = `${destPath}.sha256`;

  try {
    fs.copyFileSync(sourceFile, destPath);
    const checksum = calculateChecksum(destPath);
    fs.writeFileSync(checksumPath, checksum, 'utf8');

    // Prune backups beyond retention limit (keep 30 most recent)
    pruneOldBackups(30);

    return {
      success: true,
      backupFile: filename,
      backupPath: destPath,
      checksum,
      createdAt: now.toISOString()
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Prunes old backups keeping the N most recent
 */
function pruneOldBackups(retentionCount = 30) {
  try {
    const files = fs.readdirSync(config.paths.backupDir)
      .filter(f => f.startsWith('job_history_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(config.paths.backupDir, f);
        return { name: f, fullPath, time: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > retentionCount) {
      const toDelete = files.slice(retentionCount);
      toDelete.forEach(item => {
        try {
          fs.unlinkSync(item.fullPath);
          const checksumPath = `${item.fullPath}.sha256`;
          if (fs.existsSync(checksumPath)) fs.unlinkSync(checksumPath);
        } catch (e) {}
      });
    }
  } catch (err) {
    console.error('[BackupService] Error pruning old backups:', err.message);
  }
}

/**
 * Restores a backup after verifying its SHA-256 checksum
 */
function restoreBackup(backupFilename) {
  const backupPath = path.isAbsolute(backupFilename) 
    ? backupFilename 
    : path.join(config.paths.backupDir, backupFilename);

  if (!fs.existsSync(backupPath)) {
    return { success: false, error: `Backup file does not exist: ${backupPath}` };
  }

  const checksumFile = `${backupPath}.sha256`;
  if (fs.existsSync(checksumFile)) {
    const expectedChecksum = fs.readFileSync(checksumFile, 'utf8').trim();
    const actualChecksum = calculateChecksum(backupPath);

    if (expectedChecksum !== actualChecksum) {
      return {
        success: false,
        error: `Integrity check failed! Expected ${expectedChecksum}, got ${actualChecksum}`
      };
    }
  }

  try {
    // Before restoring, take a safety backup of current state
    if (fs.existsSync(config.paths.historyFile)) {
      createBackup('pre-restore-safety');
    }

    fs.copyFileSync(backupPath, config.paths.historyFile);
    return {
      success: true,
      restoredFrom: backupPath,
      restoredAt: new Date().toISOString()
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Lists available backups with metadata
 */
function listBackups() {
  try {
    const files = fs.readdirSync(config.paths.backupDir)
      .filter(f => f.startsWith('job_history_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(config.paths.backupDir, f);
        const stat = fs.statSync(fullPath);
        const checksumFile = `${fullPath}.sha256`;
        const checksum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf8').trim() : null;
        return {
          filename: f,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          checksum
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return files;
  } catch (e) {
    return [];
  }
}

module.exports = {
  calculateChecksum,
  createBackup,
  restoreBackup,
  listBackups,
  pruneOldBackups
};

