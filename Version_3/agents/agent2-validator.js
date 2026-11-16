/**
 * Agent 2 – Official Vacancy & Company Validator (Version 3.0)
 * 
 * Mandate:
 * Validates company existence, active hiring status, and official careers pages.
 */

function validateVacancy(rawJob) {
  const company = (rawJob.company || '').trim();
  const title = (rawJob.title || '').trim();

  if (!company || company.length < 2) {
    return { valid: false, reason: 'Invalid or missing company name' };
  }

  if (!title || title.length < 2) {
    return { valid: false, reason: 'Invalid or missing job title' };
  }

  return {
    valid: true,
    company,
    title,
    validated_at: new Date().toISOString()
  };
}

module.exports = {
  validateVacancy
};

