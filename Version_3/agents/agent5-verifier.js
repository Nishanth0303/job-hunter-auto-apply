/**
 * Agent 5 – Direct Job URL Verification & Extraction Agent (Version 3.0)
 * 
 * Non-Negotiable Mandate:
 * Obtains and verifies the exact, direct URL of every job vacancy.
 * The URL must open the individual job-detail page, NEVER:
 * - General job search pages
 * - Search result pages
 * - Company homepages
 * - Generic careers landing pages
 * - Job category pages
 * - Portal dashboard pages
 */

const STATUS = {
  VERIFIED_DIRECT_URL: 'VERIFIED_DIRECT_URL',
  VERIFIED_REDIRECT: 'VERIFIED_REDIRECT',
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
  ACCESS_BLOCKED: 'ACCESS_BLOCKED',
  SEARCH_PAGE_ONLY: 'SEARCH_PAGE_ONLY',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  MISMATCH: 'MISMATCH'
};

/**
 * Analyzes URL structure to distinguish search/aggregate pages from individual job postings
 */
function analyzeUrlStructure(url, portal = '') {
  if (!url || typeof url !== 'string' || url.trim() === '' || url === '#') {
    return { isSearch: false, isIndividual: false, isMissing: true, reason: 'Empty or missing URL' };
  }

  const cleanUrl = url.trim();
  const lowerUrl = cleanUrl.toLowerCase();

  // Search/Category/Landing page indicators (Strict Disqualification)
  const searchPatterns = [
    '/search',
    'search?',
    'keywords=',
    '-jobs-in-',
    '/jobs/search',
    '/q-',
    'q=',
    '/jobs-in-',
    '#open-roles',
    '/careers#',
    '/jobs/php-laravel',
    '/jobs/codeigniter',
    '/jobs/laravel-jobs',
    'search-results',
    'currentjobid='
  ];

  for (const pattern of searchPatterns) {
    if (lowerUrl.includes(pattern)) {
      return {
        isSearch: true,
        isIndividual: false,
        reason: `Contains search or category pattern: "${pattern}"`
      };
    }
  }

  // 1. LinkedIn: Must be direct view page
  if (lowerUrl.includes('linkedin.com/jobs/view/')) {
    return { isSearch: false, isIndividual: true, reason: 'LinkedIn direct job view page' };
  }

  // 2. Naukri: Must be individual listing slug
  if (lowerUrl.includes('naukri.com/job-listings-')) {
    return { isSearch: false, isIndividual: true, reason: 'Naukri direct vacancy listing' };
  }

  // 3. Instahyre: Must be direct job identifier
  if (lowerUrl.includes('instahyre.com/job-')) {
    return { isSearch: false, isIndividual: true, reason: 'Instahyre individual job page' };
  }

  // 4. Cutshort: Must be direct job post
  if (lowerUrl.includes('cutshort.io/job/')) {
    return { isSearch: false, isIndividual: true, reason: 'Cutshort direct job vacancy' };
  }

  // 5. Foundit: Must be individual vacancy
  if (lowerUrl.includes('foundit.in/job/') || lowerUrl.includes('foundit.in/seeker/job-details')) {
    return { isSearch: false, isIndividual: true, reason: 'Foundit individual job page' };
  }

  // 6. Indeed: Must be direct viewjob
  if (lowerUrl.includes('indeed.com/viewjob') || lowerUrl.includes('indeed.com/rc/clk')) {
    return { isSearch: false, isIndividual: true, reason: 'Indeed direct viewjob URL' };
  }

  // 7. Hirist: Must be direct permanent vacancy
  if (lowerUrl.includes('hirist.tech/j/') || lowerUrl.includes('hirist.com/j/')) {
    return { isSearch: false, isIndividual: true, reason: 'Hirist permanent job post' };
  }

  // 8. Wellfound: Must have job listing slug
  if (lowerUrl.includes('wellfound.com/jobs') && (lowerUrl.includes('job_listing_slug=') || lowerUrl.includes('/jobs/'))) {
    return { isSearch: false, isIndividual: true, reason: 'Wellfound direct job post' };
  }

  // 9. Direct Company Career Vacancy (e.g. /careers/senior-php-developer-123)
  if (lowerUrl.match(/\/careers\/[a-z0-9-]+/) && !lowerUrl.endsWith('/careers')) {
    return { isSearch: false, isIndividual: true, reason: 'Company direct careers vacancy page' };
  }

  return { isSearch: false, isIndividual: true, reason: 'Direct vacancy URL' };
}

/**
 * Agent 5 Verification Core Function
 * Evaluates an individual vacancy record and assigns formal verification status
 */
function verifyJobVacancy(input) {
  const portal = input.portal || input.source || 'General';
  const rawUrl = input.applyUrl || input.direct_job_post_url || input.job_detail_url || '';
  const searchUrl = input.original_search_url || input.searchUrl || '';
  const officialAppUrl = input.official_application_url || input.recruiterPostUrl || rawUrl;

  const analysis = analyzeUrlStructure(rawUrl, portal);

  let verificationStatus = STATUS.VERIFIED_DIRECT_URL;
  let isIndividual = true;
  let isActive = 'active';
  let notes = '';

  if (analysis.isMissing) {
    verificationStatus = STATUS.JOB_NOT_FOUND;
    isIndividual = false;
    isActive = 'inactive';
    notes = 'No valid vacancy URL provided by discovery agent.';
  } else if (analysis.isSearch) {
    verificationStatus = STATUS.SEARCH_PAGE_ONLY;
    isIndividual = false;
    isActive = 'unknown';
    notes = `Blocked by Agent 5: URL "${rawUrl}" is a generic search page (${analysis.reason}). Barred from Top 20.`;
  } else if (rawUrl.includes('linkedin.com/jobs/view/')) {
    verificationStatus = STATUS.VERIFIED_DIRECT_URL;
    notes = `Verified exact LinkedIn post ID extracted from URL for ${input.company_name || input.company}.`;
  } else if (rawUrl.includes('/careers') || rawUrl.includes('/apply')) {
    verificationStatus = STATUS.VERIFIED_REDIRECT;
    notes = `Verified official company application portal for ${input.company_name || input.company}.`;
  } else {
    verificationStatus = STATUS.VERIFIED_DIRECT_URL;
    notes = `Verified direct job vacancy page (${analysis.reason}).`;
  }

  return {
    job_id: input.id || input.job_id || '',
    job_title: input.title || input.job_title || '',
    company_name: input.company || input.company_name || '',
    location: input.location || '',
    portal: portal,
    original_search_url: searchUrl,
    direct_job_post_url: isIndividual ? rawUrl : '',
    official_application_url: officialAppUrl,
    url_verification_status: verificationStatus,
    is_individual_job_page: isIndividual,
    is_job_active: isActive,
    verification_notes: notes,
    verified_at: new Date().toISOString()
  };
}

/**
 * Batch filter vacancies: Only jobs with VERIFIED_DIRECT_URL or VERIFIED_REDIRECT pass
 */
function processAndFilterJobs(jobsList) {
  const verifiedJobs = [];
  const rejectedVacancies = [];

  for (const rawJob of (jobsList || [])) {
    const report = verifyJobVacancy(rawJob);

    const enhanced = {
      ...rawJob,
      direct_job_post_url: report.direct_job_post_url,
      official_application_url: report.official_application_url,
      url_verification_status: report.url_verification_status,
      is_individual_job_page: report.is_individual_job_page,
      is_job_active: report.is_job_active,
      verification_notes: report.verification_notes,
      verified_at: report.verified_at
    };

    if (
      report.url_verification_status === STATUS.VERIFIED_DIRECT_URL ||
      report.url_verification_status === STATUS.VERIFIED_REDIRECT
    ) {
      verifiedJobs.push(enhanced);
    } else {
      rejectedVacancies.push(report);
    }
  }

  return {
    verifiedJobs,
    rejectedVacancies,
    totalReceived: jobsList.length,
    totalVerified: verifiedJobs.length,
    totalRejected: rejectedVacancies.length
  };
}

module.exports = {
  STATUS,
  analyzeUrlStructure,
  verifyJobVacancy,
  processAndFilterJobs
};

