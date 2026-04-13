// server/routes/auth.js — Authentication and User Sync routes

const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/auth/sync
 * Syncs Clerk user data to Supabase 'users' table
 */
router.post('/sync', authMiddleware, async (req, res, next) => {
  try {
    const user = req.user; // Attached by authMiddleware (Clerk user object)
    
    // Extract data from Clerk user object
    const clerkId = user.id;
    const email = user.emailAddresses[0]?.emailAddress;
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';
    const phone = user.phoneNumbers[0]?.phoneNumber || 'N/A';

    // Upsert into Supabase 'users' table
    const { data: upsertedUser, error } = await supabase
      .from('users')
      .upsert({
        clerk_id: clerkId,
        email: email,
        name: name,
        phone: phone,
        role: 'customer',
        password: 'AUTH_MANAGED_BY_CLERK' // Placeholder since clerk handles auth
      }, {
        onConflict: 'clerk_id'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'User synced successfully',
      user: upsertedUser
    });
  } catch (err) {
    console.error('User Sync Error:', err);
    next(err);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      email: req.user.emailAddresses[0]?.emailAddress,
      role: 'customer' // Derived from our DB if needed
    },
  });
});

module.exports = router;
