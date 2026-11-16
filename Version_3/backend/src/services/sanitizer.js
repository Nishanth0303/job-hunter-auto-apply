const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Masks an email address (e.g. r.nishanth2004@gmail.com -> r.***@gmail.com)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const visible = name.length > 2 ? name.slice(0, 2) : name.slice(0, 1);
  return `${visible}***@${domain}`;
}

/**
 * Masks a phone number (e.g. 8220607076 -> +91 ********76)
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    const last2 = digits.slice(-2);
    return `+91 ********${last2}`;
  }
  return '+91 **********';
}

/**
 * Sanitizes a single job object for public display on GitHub Pages
 */
function sanitizeJobForPublic(job) {
  if (!job) return null;

  // Clone object
  const clean = { ...job };

  // Strip private recruiter notes and application history details
  delete clean.userNotes;
  delete clean.privateRecruiterNotes;
  delete clean.salaryNegotiation;
  delete clean.internalAuditLogs;

  // Mask candidate contact in coverNote if present
  if (clean.coverNote && typeof clean.coverNote === 'string') {
    clean.coverNote = clean.coverNote
      .replace(/r\.nishanth2004@gmail\.com/gi, 'r.***@gmail.com')
      .replace(/\+?91[\s-]?8220607076/g, '+91 ********76')
      .replace(/8220607076/g, '+91 ********76');
  }

  return clean;
}

/**
 * Sanitizes candidate profile for public presentation
 */
function sanitizeCandidateProfile(profile) {
  if (!profile || !profile.candidate) return {};

  const cleanCandidate = { ...profile.candidate };
  delete cleanCandidate.raw_phone;
  delete cleanCandidate.raw_email;
  delete cleanCandidate.private_notes;

  cleanCandidate.contact = {
    email: maskEmail(cleanCandidate.contact?.email || 'r.nishanth2004@gmail.com'),
    phone: maskPhone(cleanCandidate.contact?.phone || '8220607076'),
    portfolio_url: cleanCandidate.contact?.portfolio_url || 'https://nishanth0303.github.io/Nishanth-portfolio/',
    linkedin_url: cleanCandidate.contact?.linkedin_url || 'https://linkedin.com/in/rnishanth2004'
  };

  return {
    candidate: cleanCandidate,
    sanitized_at: new Date().toISOString()
  };
}

/**
 * Generates the sanitized public feed for GitHub Pages
 */
function generatePublicFeed(jobsList, outputPath = null) {
  const targetPath = outputPath || config.paths.publicJobsFile;
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sanitizedJobs = (jobsList || []).map(sanitizeJobForPublic);
  fs.writeFileSync(targetPath, JSON.stringify(sanitizedJobs, null, 2), 'utf8');

  return {
    success: true,
    count: sanitizedJobs.length,
    outputPath: targetPath
  };
}

module.exports = {
  maskEmail,
  maskPhone,
  sanitizeJobForPublic,
  sanitizeCandidateProfile,
  generatePublicFeed
};

