/**
 * Agent 3 – Candidate Relevance Scorer (Version 3.0)
 * 
 * Mandate:
 * Computes pure candidate relevance (0–100%) for eligible jobs using configurable weights.
 * Generates an explainable sentence-level breakdown for every score.
 * Selects the optimal resume variant.
 */

const fs = require('fs');
const path = require('path');

// Safe configuration loader
function loadScoringConfig() {
  const configPath = path.resolve(__dirname, '../config/scoring.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {}

  // Fallback defaults
  return {
    relevance_weights: {
      core_skills: 0.45,
      experience: 0.25,
      domain_alignment: 0.20,
      location_preference: 0.10
    },
    tier_thresholds: {
      excellent: { min: 94, label: "Excellent Match" },
      very_good: { min: 89, label: "Very Good Match" },
      good: { min: 83, label: "Good Match" },
      fair: { min: 0, label: "Potential Match" }
    },
    location_scores: {
      coimbatore: 100,
      chennai: 95,
      bangalore: 95,
      remote: 100,
      india: 90,
      other: 50
    }
  };
}

/**
 * Calculates Core Skills Score (0 - 100)
 */
function evaluateCoreSkills(text) {
  const lower = text.toLowerCase();
  let score = 50; // baseline
  const matched = [];
  const missing = [];

  const keySkills = [
    { name: 'PHP', pattern: /\bphp\b/i, pts: 20 },
    { name: 'Laravel', pattern: /\blaravel\b/i, pts: 20 },
    { name: 'CodeIgniter', pattern: /\bcodeigniter\b/i, pts: 15 },
    { name: 'MySQL', pattern: /\bmysql\b/i, pts: 15 },
    { name: 'REST APIs', pattern: /\b(rest|api|apis|restful)\b/i, pts: 15 },
    { name: 'MVC', pattern: /\bmvc\b/i, pts: 10 },
    { name: 'React', pattern: /\breact\b/i, pts: 5 }
  ];

  for (const s of keySkills) {
    if (s.pattern.test(lower)) {
      score += s.pts;
      matched.push(s.name);
    } else if (['PHP', 'Laravel', 'MySQL'].includes(s.name)) {
      missing.push(s.name);
    }
  }

  return {
    score: Math.min(100, score),
    matched,
    missing: missing.length ? missing : ['None critical']
  };
}

/**
 * Calculates Experience Score (0 - 100)
 * Nishanth R has 5.0 years experience.
 */
function evaluateExperience(text) {
  const lower = text.toLowerCase();
  // Check for experience patterns like "4-6 years", "5+ years", "3-5 years"
  if (lower.includes('4-6') || lower.includes('4 to 6') || lower.includes('5 years') || lower.includes('5+ years') || lower.includes('3-5')) {
    return { score: 100, explanation: 'Ideal 4–6 years bracket (Nishanth: 5.0 yrs)' };
  }
  if (lower.includes('3+') || lower.includes('3-6') || lower.includes('2-5')) {
    return { score: 95, explanation: 'Strong fit with 5.0 years experience' };
  }
  if (lower.includes('7+') || lower.includes('8+') || lower.includes('10+')) {
    return { score: 75, explanation: 'Senior role targeting 7+ years (Nishanth: 5.0 yrs)' };
  }
  if (lower.includes('0-2') || lower.includes('fresher') || lower.includes('intern')) {
    return { score: 70, explanation: 'Entry level role (Overqualified: 5.0 yrs)' };
  }
  return { score: 90, explanation: 'Standard professional experience requirement' };
}

/**
 * Calculates Domain Alignment Score (0 - 100)
 */
function evaluateDomain(text) {
  const lower = text.toLowerCase();
  let score = 70;
  const matchedDomains = [];

  const domains = [
    { name: 'ERP Systems', pattern: /\b(erp|enterprise)\b/i, pts: 10 },
    { name: 'Billing & Invoicing', pattern: /\b(billing|invoice|invoicing|gst|tax)\b/i, pts: 10 },
    { name: 'CRM Platforms', pattern: /\b(crm|lead|sales)\b/i, pts: 10 },
    { name: 'E-commerce', pattern: /\b(e-commerce|ecommerce|cart|checkout)\b/i, pts: 10 },
    { name: 'Payment Gateways', pattern: /\b(payment|gateway|razorpay|cashfree|stripe)\b/i, pts: 10 }
  ];

  for (const d of domains) {
    if (d.pattern.test(lower)) {
      score += d.pts;
      matchedDomains.push(d.name);
    }
  }

  return {
    score: Math.min(100, score),
    matchedDomains: matchedDomains.length ? matchedDomains : ['General Software Systems']
  };
}

/**
 * Calculates Location Preference Score (0 - 100)
 */
function evaluateLocation(locStr, config) {
  const lower = (locStr || '').toLowerCase();
  const locScores = config.location_scores || {};

  if (lower.includes('coimbatore')) return { score: locScores.coimbatore || 100, label: 'Coimbatore (Local Home City)' };
  if (lower.includes('remote')) return { score: locScores.remote || 100, label: 'Remote (India)' };
  if (lower.includes('chennai')) return { score: locScores.chennai || 95, label: 'Chennai (Target Region)' };
  if (lower.includes('bangalore') || lower.includes('bengaluru')) return { score: locScores.bangalore || 95, label: 'Bangalore (Target Region)' };
  if (lower.includes('india')) return { score: locScores.india || 90, label: 'India General' };

  return { score: locScores.other || 50, label: locStr || 'Other' };
}

/**
 * Selects recommended resume variant based on job keywords
 */
function selectResumeVariant(title, desc) {
  const combined = `${title} ${desc}`.toLowerCase();

  if (combined.includes('full stack') || combined.includes('fullstack') || combined.includes('react')) {
    return {
      variant: 'Full Stack Developer Resume',
      portfolioUrl: 'https://nishanth0303.github.io/Nishanth-portfolio/full-stack.html'
    };
  }
  if (combined.includes('erp') || combined.includes('crm') || combined.includes('billing') || combined.includes('application')) {
    return {
      variant: 'Application Developer Resume',
      portfolioUrl: 'https://nishanth0303.github.io/Nishanth-portfolio/application-dev.html'
    };
  }
  if (combined.includes('software developer') || combined.includes('software engineer') || combined.includes('backend developer')) {
    return {
      variant: 'Software Developer Resume',
      portfolioUrl: 'https://nishanth0303.github.io/Nishanth-portfolio/software-dev.html'
    };
  }

  return {
    variant: 'PHP Developer Resume',
    portfolioUrl: 'https://nishanth0303.github.io/Nishanth-portfolio/php-dev.html'
  };
}

/**
 * Main Scoring Function
 */
function calculateRelevanceScore(job) {
  const config = loadScoringConfig();
  const weights = config.relevance_weights;

  const combinedText = `${job.title || job.job_title || ''} ${job.description || ''} ${job.company || ''}`;
  
  const skillEval = evaluateCoreSkills(combinedText);
  const expEval = evaluateExperience(combinedText);
  const domEval = evaluateDomain(combinedText);
  const locEval = evaluateLocation(job.location, config);

  const rawScore = 
    (skillEval.score * weights.core_skills) +
    (expEval.score * weights.experience) +
    (domEval.score * weights.domain_alignment) +
    (locEval.score * weights.location_preference);

  const finalScore = Math.round(Math.min(99, Math.max(70, rawScore)));

  // Determine Tier
  const tiers = config.tier_thresholds;
  let tierLabel = tiers.fair.label;
  if (finalScore >= tiers.excellent.min) tierLabel = tiers.excellent.label;
  else if (finalScore >= tiers.very_good.min) tierLabel = tiers.very_good.label;
  else if (finalScore >= tiers.good.min) tierLabel = tiers.good.label;

  const resumeSelection = selectResumeVariant(job.title || job.job_title || '', job.description || '');

  const explainSentence = `${tierLabel} (${finalScore}%): Strong alignment with your 5 years in ${skillEval.matched.slice(0, 3).join(', ')}, ${domEval.matchedDomains[0]}, and ${locEval.label}. Suggested Resume: ${resumeSelection.variant}.`;

  return {
    score: finalScore,
    tier: tierLabel,
    explanation: explainSentence,
    matchedSkills: skillEval.matched,
    unmatchedSkills: skillEval.missing,
    matchedDomains: domEval.matchedDomains,
    recommendedResume: resumeSelection.variant,
    portfolioUrl: resumeSelection.portfolioUrl,
    breakdown: {
      core_skills: skillEval.score,
      experience: expEval.score,
      domain: domEval.score,
      location: locEval.score
    }
  };
}

module.exports = {
  loadScoringConfig,
  calculateRelevanceScore,
  evaluateCoreSkills,
  evaluateExperience,
  evaluateDomain,
  evaluateLocation,
  selectResumeVariant
};

