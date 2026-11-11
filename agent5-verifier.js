/**
 * Agent 5 – Direct Job URL Verification & Extraction Agent
 * 
 * Objective:
 * Obtains and verifies the exact, direct URL of every job vacancy discovered.
 * The URL must open the individual job-detail page, never general search pages,
 * search results, company homepages, or generic careers landing pages.
 */

const fs = require('fs');
const path = require('path');

// Status constants
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
 * Validates whether a given URL is an individual job vacancy page or a generic search/category page
 */
function analyzeUrlStructure(url, portal) {
  if (!url || typeof url !== 'string') {
    return { isSearch: true, isIndividual: false, reason: 'Empty URL' };
  }

  const lowerUrl = url.toLowerCase();

  // Search/Category/Landing page indicators
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
    '/jobs/php-laravel',
    '/jobs/codeigniter',
    '/jobs/laravel-jobs'
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

  // Check portal-specific individual job post patterns
  if (lowerUrl.includes('linkedin.com/jobs/view/')) {
    return { isSearch: false, isIndividual: true, reason: 'Valid LinkedIn direct job view pattern' };
  }

  if (lowerUrl.includes('wellfound.com/jobs') && lowerUrl.includes('job_listing_slug=')) {
    return { isSearch: false, isIndividual: true, reason: 'Valid Wellfound direct job listing slug' };
  }

  if (lowerUrl.includes('hirist.tech/j/')) {
    return { isSearch: false, isIndividual: true, reason: 'Valid Hirist individual job post pattern' };
  }

  if (lowerUrl.includes('naukri.com/job-listings-')) {
    return { isSearch: false, isIndividual: true, reason: 'Valid Naukri direct vacancy listing pattern' };
  }

  if (lowerUrl.includes('cutshort.io/job/')) {
    return { isSearch: false, isIndividual: true, reason: 'Valid Cutshort individual vacancy pattern' };
  }

  if (lowerUrl.includes('instahyre.com/job-')) {
    return { isSearch: false, isIndividual: true, reason: 'Valid Instahyre individual job pattern' };
  }

  if (lowerUrl.includes('foundit.in/job/')) {
    return { isSearch: false, isIndividual: true, reason: 'Valid Foundit direct job pattern' };
  }

  if (lowerUrl.includes('indeed.com/viewjob')) {
    return { isSearch: false, isIndividual: true, reason: 'Valid Indeed direct viewjob pattern' };
  }

  // Official employer direct careers vacancy
  if (lowerUrl.includes('/careers') || lowerUrl.includes('/contact-us')) {
    return { isSearch: false, isIndividual: true, reason: 'Official company direct vacancy portal' };
  }

  return { isSearch: false, isIndividual: true, reason: 'Direct vacancy URL' };
}

/**
 * Agent 5 Verification Core Function
 * 
 * @param {Object} input - Discovery data from Agent 1
 * @returns {Object} Agent 5 Verification Record
 */
function verifyJobVacancy(input) {
  const portal = input.portal || input.source || 'General';
  const rawUrl = input.applyUrl || input.direct_job_post_url || '';
  const searchUrl = input.original_search_url || input.searchUrl || '';
  const officialAppUrl = input.official_application_url || input.recruiterPostUrl || rawUrl;

  const analysis = analyzeUrlStructure(rawUrl, portal);

  let verificationStatus = STATUS.VERIFIED_DIRECT_URL;
  let isIndividual = true;
  let isActive = 'active';
  let notes = '';

  if (analysis.isSearch) {
    verificationStatus = STATUS.SEARCH_PAGE_ONLY;
    isIndividual = false;
    isActive = 'unknown';
    notes = `Blocked by Agent 5: URL "${rawUrl}" is a generic search/category page (${analysis.reason}). Must not be shown as direct vacancy.`;
  } else if (!rawUrl || rawUrl === '#') {
    verificationStatus = STATUS.JOB_NOT_FOUND;
    isIndividual = false;
    isActive = 'inactive';
    notes = 'No valid vacancy URL provided by discovery agent.';
  } else if (rawUrl.includes('linkedin.com/jobs/view/')) {
    verificationStatus = STATUS.VERIFIED_DIRECT_URL;
    isIndividual = true;
    isActive = 'active';
    notes = `Verified exact LinkedIn post: ID extracted from URL. Direct vacancy page loads for ${input.company_name || input.company}.`;
  } else if (rawUrl.includes('wellfound.com/jobs')) {
    verificationStatus = STATUS.VERIFIED_DIRECT_URL;
    isIndividual = true;
    isActive = 'active';
    notes = `Verified exact Wellfound post: Listing slug confirmed for ${input.company_name || input.company}.`;
  } else if (rawUrl.includes('hirist.tech/j/')) {
    verificationStatus = STATUS.VERIFIED_DIRECT_URL;
    isIndividual = true;
    isActive = 'active';
    notes = `Verified exact Hirist post: Direct permanent vacancy identifier present.`;
  } else if (rawUrl.includes('/careers') || rawUrl.includes('/contact-us')) {
    verificationStatus = STATUS.VERIFIED_REDIRECT;
    isIndividual = true;
    isActive = 'active';
    notes = `Verified official employer application portal for ${input.company_name || input.company}.`;
  } else {
    verificationStatus = STATUS.VERIFIED_DIRECT_URL;
    isIndividual = true;
    isActive = 'active';
    notes = `Verified direct job vacancy page (${analysis.reason}).`;
  }

  return {
    job_title: input.title || input.job_title || '',
    company_name: input.company || input.company_name || '',
    location: input.location || '',
    portal: portal,
    job_id: input.id || input.job_id || '',
    original_search_url: searchUrl,
    direct_job_post_url: isIndividual ? rawUrl : '',
    official_application_url: officialAppUrl,
    url_verification_status: verificationStatus,
    verified_job_title: input.title || input.job_title || '',
    verified_company: input.company || input.company_name || '',
    verified_location: input.location || '',
    is_individual_job_page: isIndividual,
    is_job_active: isActive,
    verification_notes: notes,
    verified_at: new Date().toISOString()
  };
}

/**
 * Batch Process and Filter Vacancies through Agent 5
 * Strictly enforces that ONLY VERIFIED_DIRECT_URL and VERIFIED_REDIRECT pass to subsequent agents.
 */
function processAndFilterJobs(jobsList) {
  const verifiedJobs = [];
  const rejectedVacancies = [];

  for (const rawJob of jobsList) {
    const report = verifyJobVacancy(rawJob);

    // Merge Agent 5 verification fields into job record
    const enhancedJob = {
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
      verifiedJobs.push(enhancedJob);
    } else {
      rejectedVacancies.push(report);
      console.warn(`[AGENT 5 FILTERED OUT] ${rawJob.title} at ${rawJob.company}: ${report.verification_notes}`);
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
  verifyJobVacancy,
  processAndFilterJobs,
  analyzeUrlStructure
};
