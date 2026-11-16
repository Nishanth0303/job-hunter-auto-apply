const crypto = require('crypto');
const config = require('../config');

/**
 * Lightweight standard crypto JWT implementation (HMAC-SHA256)
 * Avoids third-party dependency issues in constrained environments.
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

function signJWT(payload, secret = config.jwtSecret, expiresInDays = 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token, secret = config.jwtSecret) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signatureB64 !== expectedSig) {
    return { valid: false, error: 'Invalid token signature' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token has expired' };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Invalid token payload' };
  }
}

/**
 * Authentication Middleware
 * Checks for Bearer JWT or X-Admin-Key header
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const adminKey = req.headers['x-admin-key'];

  // Check Admin API key
  if (adminKey && adminKey === config.adminApiKey) {
    req.user = { role: 'admin', authType: 'api_key' };
    return next();
  }

  // Check Bearer JWT
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const result = verifyJWT(token);

    if (result.valid) {
      req.user = result.payload;
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized', message: result.error });
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required. Provide Bearer token or valid X-Admin-Key.'
  });
}

/**
 * Admin-only Authorization Middleware
 */
function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === config.adminApiKey) {
    req.user = { role: 'admin' };
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const result = verifyJWT(token);
    if (result.valid && result.payload.role === 'admin') {
      req.user = result.payload;
      return next();
    }
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'Admin authorization required for this operation.'
  });
}

/**
 * In-memory sliding window Rate Limiter
 */
function createRateLimiter(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  const requestLogs = new Map();

  return function rateLimiter(req, res, next) {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let timestamps = requestLogs.get(clientIp) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 60000} minutes.`
      });
    }

    timestamps.push(now);
    requestLogs.set(clientIp, timestamps);
    next();
  };
}

module.exports = {
  signJWT,
  verifyJWT,
  requireAuth,
  requireAdmin,
  createRateLimiter
};

