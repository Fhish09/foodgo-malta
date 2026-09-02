const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = require('../db/schema');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', function (req, res) {
  try {
    const body = req.body || {};
    const email = body.email;
    const password = body.password;
    const name = body.name;
    const phone = body.phone;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailNorm);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuid();
    const password_hash = bcrypt.hashSync(String(password), 10);
    db.prepare(
      'INSERT INTO users (id, email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, \'customer\', ?)'
    ).run(id, emailNorm, password_hash, String(name).trim(), phone ? String(phone).trim() : null);

    const user = db.prepare(
      'SELECT id, email, name, role, phone, created_at FROM users WHERE id = ?'
    ).get(id);

    const token = auth.signToken(user);
    res.status(201).json({ token: token, user: user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', function (req, res) {
  try {
    const body = req.body || {};
    const email = body.email;
    const password = body.password;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(emailNorm);
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const ok = bcrypt.compareSync(String(password), row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      phone: row.phone,
      created_at: row.created_at
    };
    const token = auth.signToken(user);
    res.json({ token: token, user: user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', function (req, res) {
  auth.requireAuth(req, res, function () {
    try {
      const user = db.prepare(
        'SELECT id, email, name, role, phone, created_at FROM users WHERE id = ?'
      ).get(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user: user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });
});

module.exports = router;
