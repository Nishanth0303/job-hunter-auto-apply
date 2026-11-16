const express = require('express');
const path = require('path');
const config = require('./config');
const { createRateLimiter } = require('./middleware/auth');

const app = express();

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// CORS Handling
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || config.allowedOrigins.includes(origin) || config.nodeEnv === 'development') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// JSON Parser
app.use(express.json({ limit: '2mb' }));

// Rate Limiter
app.use('/api/', createRateLimiter(config.rateLimit.maxRequests, config.rateLimit.windowMs));

// Health Check Endpoint (For Cloud Deployments & Monitors)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '3.0.0',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/jobs', require('./routes/jobs'));
app.use('/api/v1/scan', require('./routes/scan'));
app.use('/api/v1/settings', require('./routes/settings'));
app.use('/api/v1/admin', require('./routes/backup'));

// Static Frontend Serving (Dashboard)
app.use(express.static(config.paths.frontendPublic));

// Fallback to index.html for client-side navigation
app.get('*', (req, res) => {
  const indexFile = path.join(config.paths.frontendPublic, 'index.html');
  if (require('fs').existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  res.status(404).json({ error: 'Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Start Server
if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`================================================================`);
    console.log(`🚀 JobHuntAI Version 3.0 Cloud Backend Running!`);
    console.log(`📡 Port            : ${config.port}`);
    console.log(`🌐 Environment     : ${config.nodeEnv}`);
    console.log(`💻 Local URL       : http://localhost:${config.port}`);
    console.log(`🩺 Health Check    : http://localhost:${config.port}/health`);
    console.log(`================================================================`);
  });

  // Graceful Shutdown
  const gracefulShutdown = (signal) => {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;

