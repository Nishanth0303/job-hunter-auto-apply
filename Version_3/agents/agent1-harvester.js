/**
 * Agent 1 – Job Discovery Harvester (Version 3.0)
 * 
 * Mandate:
 * Discovers jobs from the 8 approved portals:
 * 1. Naukri
 * 2. LinkedIn
 * 3. Instahyre
 * 4. Cutshort
 * 5. Foundit
 * 6. Indeed
 * 7. Hirist
 * 8. Wellfound
 * 
 * Respects access restrictions and extracts raw vacancy records with original URLs.
 */

const PORTALS = [
  { name: 'Naukri', baseUrl: 'https://www.naukri.com/' },
  { name: 'LinkedIn', baseUrl: 'https://www.linkedin.com/jobs/' },
  { name: 'Instahyre', baseUrl: 'https://www.instahyre.com/' },
  { name: 'Cutshort', baseUrl: 'https://cutshort.io/' },
  { name: 'Foundit', baseUrl: 'https://www.foundit.in/' },
  { name: 'Indeed', baseUrl: 'https://in.indeed.com/' },
  { name: 'Hirist', baseUrl: 'https://www.hirist.tech/' },
  { name: 'Wellfound', baseUrl: 'https://wellfound.com/' }
];

/**
 * Generates discovery query criteria from candidate profile
 */
function buildSearchQueries(candidateProfile) {
  const roles = [
    'PHP Developer',
    'Laravel Developer',
    'CodeIgniter Developer',
    'PHP Backend Developer',
    'Senior PHP Developer',
    'PHP Full Stack Developer',
    'Software Developer PHP'
  ];

  const locations = ['Coimbatore', 'Chennai', 'Bangalore', 'Remote India'];

  return { roles, locations, portals: PORTALS };
}

/**
 * Normalizes a raw scraped listing into a standard job payload
 */
function normalizeDiscoveredJob(raw) {
  return {
    id: raw.id || `raw-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    title: raw.title || 'PHP Developer',
    company: raw.company || 'Technology Company',
    location: raw.location || 'Coimbatore / Remote',
    portal: raw.portal || 'LinkedIn',
    posting_date: raw.posting_date || new Date().toISOString(),
    applyUrl: raw.applyUrl || raw.url || '#',
    description: raw.description || '',
    salary: raw.salary || 'Competitive',
    experience: raw.experience || '4–6 Years Exp'
  };
}

module.exports = {
  PORTALS,
  buildSearchQueries,
  normalizeDiscoveredJob
};

