const path = require('path');
const fs = require('fs');

// Try loading .env if present
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    });
  } catch (e) {}
}

const ROOT_DIR = path.resolve(__dirname, '../../');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(ROOT_DIR, process.env.DATA_DIR) : path.join(ROOT_DIR, 'data');
const CONFIG_DIR = process.env.CONFIG_DIR ? path.resolve(ROOT_DIR, process.env.CONFIG_DIR) : path.join(ROOT_DIR, 'config');
const BACKUP_DIR = process.env.BACKUP_DIR ? path.resolve(ROOT_DIR, process.env.BACKUP_DIR) : path.join(ROOT_DIR, 'backups');
const FRONTEND_PUBLIC = path.join(ROOT_DIR, 'frontend', 'public');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'jobhuntai_default_dev_secret_change_in_production_32b',
  adminApiKey: process.env.ADMIN_API_KEY || 'jobhuntai_admin_secret_key_v3',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://nishanth0303.github.io,http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  paths: {
    rootDir: ROOT_DIR,
    dataDir: DATA_DIR,
    configDir: CONFIG_DIR,
    backupDir: BACKUP_DIR,
    frontendPublic: FRONTEND_PUBLIC,
    jobsFile: path.join(DATA_DIR, 'jobs.json'),
    historyFile: path.join(DATA_DIR, 'job_history.json'),
    candidateConfigFile: path.join(CONFIG_DIR, 'candidate-profile.json'),
    scoringConfigFile: path.join(CONFIG_DIR, 'scoring.json'),
    lockFile: path.join(DATA_DIR, '.scan.lock'),
    publicJobsFile: path.join(FRONTEND_PUBLIC, 'data', 'jobs.json')
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    publicMaxRequests: parseInt(process.env.PUBLIC_RATE_LIMIT_MAX, 10) || 30
  }
};

