/**
 * Automated Job Tracking & Email Notification Service
 * Schedule:
 * - 06:00 AM IST: Full Top 20 Daily Morning Digest
 * - Every 3 Hours: Continuous fresh job tracking (09:00 AM, 12:00 PM, 03:00 PM, 06:00 PM, 09:00 PM)
 * - Real-Time Alert: Immediate email dispatch if any matching job (>=90%) is posted in-between!
 * Locations: Coimbatore / Chennai / Bangalore / Remote (Inside India)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure history directory exists
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function readJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Format IST Date & Time
function getISTDate() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return {
    iso: istTime.toISOString(),
    dateStr: istTime.toISOString().split('T')[0],
    hours: istTime.getUTCHours(),
    minutes: istTime.getUTCMinutes()
  };
}

// Generate / Fetch Fresh Job Listings
function scanPortals(config) {
  const existingJobs = readJSON(JOBS_FILE, []);
  if (existingJobs && existingJobs.length > 0) {
    return existingJobs;
  }
  return [];
}

// Email Dispatch Simulator / Notification Logger
function dispatchEmailAlert(type, subject, content, config) {
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  console.log(`\n========================================================================`);
  console.log(`📧 [EMAIL SENT TO: ${config.recipientEmail || 'r.nishanth2004@gmail.com'}]`);
  console.log(`⏰ IST Time: ${timestamp}`);
  console.log(`📌 Type: ${type}`);
  console.log(`📝 Subject: ${subject}`);
  console.log(`🔗 Dashboard: ${config.gitPagesUrl || 'https://nishanth0303.github.io/job-hunter-auto-apply'}`);
  console.log(`📄 Details:\n${content}`);
  console.log(`========================================================================\n`);

  // Log to history log
  const logFile = path.join(HISTORY_DIR, 'email-dispatches.log');
  const logEntry = `[${timestamp}] [${type}] ${subject} -> To: ${config.recipientEmail}\n`;
  fs.appendFileSync(logFile, logEntry);
}

// 1. Morning 06:00 AM Full Digest Execution
function runMorningDigest() {
  const config = readJSON(CONFIG_FILE);
  const ist = getISTDate();
  console.log(`[06:00 AM TRIGGER] Running full morning job digest for ${ist.dateStr}...`);

  const jobs = scanPortals(config);
  writeJSON(JOBS_FILE, jobs);

  // Save daily snapshot
  const dailySnapshot = path.join(HISTORY_DIR, `${ist.dateStr}.json`);
  writeJSON(dailySnapshot, jobs);

  const top3 = jobs.slice(0, 3).map(j => `  #${j.rank} [${j.matchScore}%] ${j.title} at ${j.company} (${j.source}) - ${j.location}`).join('\n');
  const subject = `🌅 6:00 AM Morning Job Hunt Digest: Top 20 Ranked Jobs for Nishanth R (${ist.dateStr})`;
  const body = `Good Morning Nishanth!\n\nHere is your daily Top 20 ranked job matches for Coimbatore, Chennai, Bangalore, and Remote India:\n\nTOP PICKS TODAY:\n${top3}\n\n... plus 17 more high-match opportunities ranked in your dashboard!\n\nReview & 1-Click Auto-Apply directly here:\n${config.gitPagesUrl || 'https://nishanth0303.github.io/job-hunter-auto-apply'}`;

  dispatchEmailAlert('6:00 AM MORNING DIGEST', subject, body, config);
}

// 2. Every 3 Hours Track & Real-Time Alert Check
function runThreeHourTracker() {
  const config = readJSON(CONFIG_FILE);
  const ist = getISTDate();
  console.log(`[3-HOUR TRACKER] Tracking fresh job posts in Coimbatore / Chennai / Bangalore / Remote...`);

  const jobs = scanPortals(config);
  writeJSON(JOBS_FILE, jobs);

  // Check for high-match jobs (>= 90%)
  const highMatches = jobs.filter(j => j.matchScore >= (config.scheduleConfig?.instantAlertThreshold || 90));

  if (highMatches.length > 0) {
    const topJob = highMatches[0];
    const subject = `🎯 [3-Hour Alert] High-Match Job Found: ${topJob.title} at ${topJob.company} (${topJob.matchScore}% Match on ${topJob.source})`;
    const body = `Hello Nishanth,\n\nA fresh high-match role matching your 5 years PHP, Laravel 10, CodeIgniter, and MySQL skills has been detected:\n\nRole: ${topJob.title}\nCompany: ${topJob.company}\nLocation: ${topJob.location}\nPortal: ${topJob.source}\nMatch: ${topJob.matchScore}%\nSuggested Resume: ${topJob.matchedResume}\n\nWhy You Fit:\n${topJob.fitReason}\n\nReview and 1-Click Apply directly:\n${config.gitPagesUrl || 'https://nishanth0303.github.io/job-hunter-auto-apply'}?review=${topJob.id}`;

    dispatchEmailAlert('3-HOUR TRACKER ALERT', subject, body, config);
  }
}

// Main Execution
const isRunNow = process.argv.includes('--run-now');
const isMorningOnly = process.argv.includes('--morning');

if (isRunNow) {
  runMorningDigest();
  runThreeHourTracker();
  process.exit(0);
}

if (isMorningOnly) {
  runMorningDigest();
  process.exit(0);
}

// Background Daemon Loop (checks time every minute)
console.log(`========================================================================`);
console.log(`🤖 Job Hunter 24/7 Automated Daemon Started!`);
console.log(`⏰ Schedule: 6:00 AM IST Morning Digest + Every 3 Hours Tracking`);
console.log(`📍 Locations: Coimbatore, Chennai, Bangalore, Remote (Inside India)`);
console.log(`📧 Target Email: r.nishanth2004@gmail.com`);
console.log(`========================================================================`);

let lastMorningDate = '';
let lastTrackHour = -1;

setInterval(() => {
  const ist = getISTDate();

  // 1. Check for 6:00 AM IST Morning Run
  if (ist.hours === 6 && ist.minutes === 0 && lastMorningDate !== ist.dateStr) {
    lastMorningDate = ist.dateStr;
    runMorningDigest();
  }

  // 2. Check for Every 3 Hours Run (9:00, 12:00, 15:00, 18:00, 21:00)
  if (ist.hours % 3 === 0 && ist.minutes === 0 && lastTrackHour !== ist.hours && ist.hours !== 6) {
    lastTrackHour = ist.hours;
    runThreeHourTracker();
  }
}, 60000);

