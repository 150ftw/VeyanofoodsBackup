// server/routes/auth.js — Authentication routes

const express = require('express');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
});

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Name, email, mobile number, and password are required.' });
    }

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email, phone')
      .or(`email.eq.${email},phone.eq.${phone}`)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      const field = existingUser[0].email === email ? 'Email' : 'Mobile number';
      return res.status(400).json({ error: `${field} already in use.` });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const { data: user, error: createError } = await supabase
      .from('users')
      .insert([{ name, email, phone, password: hashedPassword, role: 'customer' }])
      .select()
      .single();

    if (createError) throw createError;

    const token = signToken(user.id);

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  } catch (err) {
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
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = router;
