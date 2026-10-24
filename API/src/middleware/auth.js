const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ message: 'This account no longer exists.' });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
  }
}

function requireRole(role) {
  return (req, res, next) => req.user.role === role
    ? next()
    : res.status(403).json({ message: `A ${role} account is required for this action.` });
}

module.exports = { requireAuth, requireRole };
