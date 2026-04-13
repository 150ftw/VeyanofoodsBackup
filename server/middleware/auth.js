// server/middleware/auth.js — Clerk authentication guard middleware

const clerkClient = require('../config/clerk');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid Clerk token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token using Clerk
    const decoded = await clerkClient.verifyToken(token);
    
    // Decoded token contains user info in 'sub' (user_id)
    // We can also fetch the full user object if needed
    const user = await clerkClient.users.getUser(decoded.sub);

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired Clerk token.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Clerk Auth Middleware Error:', err);
    return res.status(401).json({ error: 'Authentication failed. Please log in with Clerk again.' });
  }
};
