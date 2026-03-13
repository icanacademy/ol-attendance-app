const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || 'default-secret';
const TOKEN_EXPIRY = '24h';

function generateToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Middleware: checks for JWT in Authorization header OR password in request body.
 * This allows gradual migration from password-per-request to JWT.
 */
function requireAdmin(req, res, next) {
  // Check Authorization header first (JWT)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.isAdmin = true;
      return next();
    }
  }

  // Fallback: check password in body (backwards compatible)
  const password = req.body?.password;
  if (password && password === process.env.ADMIN_PASSWORD) {
    req.isAdmin = true;
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = { generateToken, verifyToken, requireAdmin };
