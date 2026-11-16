/**
 * Agent 4 – Application Assistant & Cover Letter Agent (Version 3.0)
 * 
 * Mandate:
 * Formulates factual, role-aligned cover letters grounded in Nishanth R's verified experience.
 * Never invents skills, projects, or employment details.
 */

function generateCoverLetter(job, candidateProfile = {}) {
  const company = job.company || job.company_name || 'Hiring Team';
  const title = job.title || job.job_title || 'PHP Developer';
  const portal = job.portal || job.source || 'portal';

  const matchedResume = job.matchedResume || 'PHP Developer Resume';
  const portfolioUrl = job.portfolioUrl || 'https://nishanth0303.github.io/Nishanth-portfolio/php-dev.html';

  return `Dear ${company} Hiring Team,

I am writing to express my strong interest in the ${title} position discovered on ${portal}. With 5 years of specialized backend engineering experience in PHP, Laravel (including Laravel 10), and CodeIgniter, combined with hands-on expertise in MySQL query optimization and RESTful API architecture, I am eager to contribute to your engineering goals.

In my previous roles at Icore Software Technologies and Rk Creators, I focused on designing scalable web applications, automating complex ERP and billing logic, and integrating secure payment gateways. Given your focus on reliable software systems, my background in building modular backend services and optimizing relational databases aligns directly with your technical requirements.

I am based in Coimbatore and available for opportunities across Coimbatore, Chennai, Bangalore, and Remote India. Thank you for your time and consideration; I look forward to the possibility of discussing how my experience can benefit ${company}.

Portfolio: ${portfolioUrl}
LinkedIn: https://linkedin.com/in/rnishanth2004

Best regards,
Nishanth R
Phone: +91 8220607076
Email: r.nishanth2004@gmail.com
Coimbatore, Tamil Nadu`;
}

module.exports = {
  generateCoverLetter
};

