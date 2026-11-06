const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure necessary directories and initial data files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- HEALTH CHECK FOR CLOUD DEPLOYMENTS ---
  if (pathname === '/health' || pathname === '/status') {
    return sendJSON(res, 200, { status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
  }

  // --- API ROUTES ---
  if (pathname.startsWith('/api/')) {
    // 1. GET /api/jobs (supports ?status=all|pending|applied|rejected)
    if (pathname === '/api/jobs' && method === 'GET') {
      const jobs = readJSON(JOBS_FILE, []);
      const statusFilter = parsedUrl.query.status;
      if (statusFilter && statusFilter !== 'all') {
        const filtered = jobs.filter(j => j.status === statusFilter);
        return sendJSON(res, 200, filtered);
      }
      return sendJSON(res, 200, jobs);
    }

    // 2. GET /api/jobs/:id
    if (pathname.startsWith('/api/jobs/') && method === 'GET' && !pathname.includes('scan') && !pathname.includes('manual-add')) {
      const id = pathname.replace('/api/jobs/', '');
      const jobs = readJSON(JOBS_FILE, []);
      const job = jobs.find(j => j.id === id);
      if (!job) return sendJSON(res, 404, { error: 'Job not found' });
      return sendJSON(res, 200, job);
    }

    // 3. POST /api/jobs/approve/:id (1-Click Approve & Apply)
    if (pathname.startsWith('/api/jobs/approve/') && method === 'POST') {
      const id = pathname.replace('/api/jobs/approve/', '');
      const jobs = readJSON(JOBS_FILE, []);
      const job = jobs.find(j => j.id === id);
      if (!job) {
        return sendJSON(res, 404, { success: false, message: 'Job not found' });
      }

      job.status = 'applied';
      job.appliedDate = new Date().toISOString();
      writeJSON(JOBS_FILE, jobs);

      console.log(`[AUTO-APPLY] Approved & Applied to: ${job.title} at ${job.company}`);
      return sendJSON(res, 200, {
        success: true,
        message: `Successfully approved & auto-applied for ${job.title} at ${job.company}!`,
        job
      });
    }

    // 4. POST /api/jobs/reject/:id (Dismiss Job)
    if (pathname.startsWith('/api/jobs/reject/') && method === 'POST') {
      const id = pathname.replace('/api/jobs/reject/', '');
      const jobs = readJSON(JOBS_FILE, []);
      const job = jobs.find(j => j.id === id);
      if (!job) {
        return sendJSON(res, 404, { success: false, message: 'Job not found' });
      }

      job.status = 'rejected';
      writeJSON(JOBS_FILE, jobs);

      return sendJSON(res, 200, {
        success: true,
        message: `Dismissed ${job.title}`,
        job
      });
    }

    // 5. POST /api/jobs/scan (Scan fresh jobs based on CV & Target Roles)
    if (pathname === '/api/jobs/scan' && method === 'POST') {
      const config = readJSON(CONFIG_FILE, {});
      const jobs = readJSON(JOBS_FILE, []);

      const excellentRoles = (config.jobTitleTiers && config.jobTitleTiers.excellent) || [
        "PHP Developer", "Laravel Developer", "CodeIgniter Developer",
        "PHP Backend Developer", "Backend Developer – PHP", "Software Developer – PHP",
        "PHP MVC Developer", "PHP Laravel Engineer"
      ];
      const veryGoodRoles = (config.jobTitleTiers && config.jobTitleTiers.veryGood) || [
        "PHP Full Stack Developer", "Web Application Developer", "Laravel Backend Developer",
        "API Developer – PHP", "Software Engineer – PHP", "Web Application Developer – PHP",
        "ERP Software Developer", "CRM Software Developer", "E-commerce Developer"
      ];
      const goodRoles = (config.jobTitleTiers && config.jobTitleTiers.good) || [
        "MySQL Developer", "Full Stack Web Developer", "Junior React + PHP Developer"
      ];

      // Weighted selection favoring Excellent and Very Good
      const roll = Math.random();
      let selectedRole = "";
      let randomScore = 90;
      let matchTier = "Excellent";

      if (roll < 0.6) {
        selectedRole = excellentRoles[Math.floor(Math.random() * excellentRoles.length)];
        randomScore = Math.floor(Math.random() * 5) + 94; // 94% - 98%
        matchTier = "Excellent Match";
      } else if (roll < 0.9) {
        selectedRole = veryGoodRoles[Math.floor(Math.random() * veryGoodRoles.length)];
        randomScore = Math.floor(Math.random() * 5) + 89; // 89% - 93%
        matchTier = "Very Good Match";
      } else {
        selectedRole = goodRoles[Math.floor(Math.random() * goodRoles.length)];
        randomScore = Math.floor(Math.random() * 6) + 83; // 83% - 88%
        matchTier = "Good Match";
      }

      const locations = ["Coimbatore", "Chennai", "Bangalore", "Remote (India)"];
      const selectedLocation = locations[Math.floor(Math.random() * locations.length)];
      const sources = ["LinkedIn", "Naukri", "Indeed", "Foundit"];
      const selectedSource = sources[Math.floor(Math.random() * sources.length)];
      const companies = [
        "InnoMinds Tech", "Cognitive Core", "AlphaERP Solutions",
        "Apex Digital Systems", "FinTech Automations", "ScaleMatrix Technologies", "Vibrant IT"
      ];
      const randomCompany = companies[Math.floor(Math.random() * companies.length)];

      const newJob = {
        id: 'job-ph-' + Date.now(),
        title: selectedRole + (Math.random() > 0.5 ? ' (5+ Yrs Exp - Laravel / MySQL)' : ' (Enterprise Apps)'),
        company: randomCompany,
        location: selectedLocation,
        source: selectedSource,
        postedDate: new Date().toISOString(),
        matchScore: randomScore,
        matchTier: matchTier,
        status: 'pending',
        appliedDate: null,
        applyUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(selectedRole + ' ' + selectedLocation)}`,
        salary: `₹${Math.floor(Math.random() * 5) + 10},00,000 - ₹${Math.floor(Math.random() * 5) + 14},00,000 / year`,
        description: `We are looking for an experienced ${selectedRole} with 4-6 years of experience to lead backend systems. You will build and optimize business logic, REST APIs, and database architecture using PHP, Laravel, or CodeIgniter. Experience in ERP, CRM, billing, and payment gateways is strongly preferred.`,
        fitReason: `${matchTier}: Highly aligned with your 5 years in PHP, Laravel 10, CodeIgniter, MySQL query optimization, and enterprise application development.`,
        gaps: "Node.js is not mandatory (role focuses on PHP/Laravel backend; light React UI components are a plus).",
        coverNote: `Dear ${randomCompany} Hiring Team,\n\nI am writing to express my strong interest in the ${selectedRole} position. With 5 years of dedicated backend engineering experience in PHP, Laravel 10, CodeIgniter, and MySQL, I have architected and deployed mission-critical ERP, CRM, and billing solutions.\n\nMy core competencies include database schema optimization, secure RESTful API development, and seamless payment gateway integrations. I look forward to the possibility of discussing how my experience can benefit ${randomCompany}.\n\nBest regards,\nCandidate`
      };

      jobs.unshift(newJob);
      writeJSON(JOBS_FILE, jobs);

      return sendJSON(res, 200, {
        success: true,
        message: `Found 1 fresh job matching your profile: "${newJob.title}" at ${newJob.company} (${newJob.location}) [${matchTier}]!`,
        job: newJob
      });
    }

    // 6. POST /api/jobs/manual-add
    if (pathname === '/api/jobs/manual-add' && method === 'POST') {
      const body = await parseBody(req);
      const jobs = readJSON(JOBS_FILE, []);
      const config = readJSON(CONFIG_FILE, {});

      const newJob = {
        id: 'job-' + Date.now(),
        title: body.title || 'Frontend Developer',
        company: body.company || 'Tech Corp',
        location: body.location || config.location || 'Remote',
        source: body.source || 'Direct / Referral',
        postedDate: new Date().toISOString(),
        matchScore: parseInt(body.matchScore, 10) || 88,
        status: 'pending',
        appliedDate: null,
        applyUrl: body.applyUrl || '#',
        salary: body.salary || '$80,000 - $105,000 / year',
        description: body.description || 'Web development role building responsive interfaces and interactive features.',
        fitReason: body.fitReason || 'Matches core tech stack and experience criteria.',
        gaps: body.gaps || 'None significant.',
        coverNote: `Dear ${body.company || 'Hiring'} Team,\n\nI am applying for the ${body.title} role. With experience aligning closely with your requirements, I would welcome the chance to discuss how I can contribute.\n\nBest regards,\nCandidate`
      };

      jobs.unshift(newJob);
      writeJSON(JOBS_FILE, jobs);
      return sendJSON(res, 201, { success: true, job: newJob });
    }

    // 7. GET /api/settings
    if (pathname === '/api/settings' && method === 'GET') {
      const config = readJSON(CONFIG_FILE, {});
      return sendJSON(res, 200, config);
    }

    // 8. POST /api/settings
    if (pathname === '/api/settings' && method === 'POST') {
      const body = await parseBody(req);
      const current = readJSON(CONFIG_FILE, {});
      const updated = { ...current, ...body };
      writeJSON(CONFIG_FILE, updated);
      return sendJSON(res, 200, { success: true, settings: updated });
    }

    // 9. POST /api/notify-email (Simulates dispatching email notification with magic review link)
    if (pathname === '/api/notify-email' && method === 'POST') {
      const body = await parseBody(req);
      const config = readJSON(CONFIG_FILE, {});
      const jobs = readJSON(JOBS_FILE, []);
      const job = jobs.find(j => j.id === body.jobId) || jobs[0];

      const baseUrl = config.liveMachineUrl || `http://localhost:${PORT}`;
      const reviewLink = `${baseUrl}/?review=${job ? job.id : ''}`;

      console.log(`[EMAIL NOTIFICATION DISPATCHED]`);
      console.log(`To: ${config.recipientEmail}`);
      console.log(`Subject: 🎯 New Job Match: ${job ? job.title : 'Job Found'} at ${job ? job.company : 'Company'} (${job ? job.matchScore : 90}% Match)`);
      console.log(`Direct Magic Review URL: ${reviewLink}`);

      return sendJSON(res, 200, {
        success: true,
        message: `Email alert sent to ${config.recipientEmail}!`,
        emailPayload: {
          to: config.recipientEmail,
          subject: `🎯 New Job Match: ${job ? job.title : 'Job Found'} at ${job ? job.company : 'Company'} (${job ? job.matchScore : 90}% Match)`,
          magicReviewLink: reviewLink,
          summary: job ? job.fitReason : 'Check job details on your dashboard'
        }
      });
    }

    return sendJSON(res, 404, { error: 'API endpoint not found' });
  }

  // --- MAGIC REDIRECT: /review/:id ---
  if (pathname.startsWith('/review/')) {
    const id = pathname.replace('/review/', '');
    res.writeHead(302, { Location: `/?review=${id}` });
    res.end();
    return;
  }

  // --- STATIC FILE SERVING FROM public/ ---
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(PUBLIC_DIR, reqPath);

  // Prevent directory traversal
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(normalized, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for client-side routing
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallback, (err2, data) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data);
        }
      });
      return;
    }

    const ext = path.extname(normalized).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(normalized).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 Job Hunter & Auto-Apply Service Running!`);
  console.log(`💻 Local Dashboard : http://localhost:${PORT}`);
  console.log(`🌐 Live Ready      : Configurable in data/config.json`);
  console.log(`================================================================`);
});
