const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/schema');
const { requireAuth } = require('../middleware/auth');
const realtime = require('../realtime');

const router = express.Router();

router.get('/order/:orderId', requireAuth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const role = req.user.role;
    if (role === 'customer' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (role === 'driver') {
      const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
      if (!driver || order.driver_id !== driver.id) {
        return res.status(403).json({ error: 'Not assigned to this order' });
      }
    }

    const messages = db.prepare(`
      SELECT * FROM chat_messages
      WHERE order_id = ?
      ORDER BY created_at ASC
      LIMIT 200
    `).all(req.params.orderId);

    res.json({ messages, order_id: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load chat' });
  }
});

router.get('/ops', requireAuth, (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const messages = db.prepare(`
      SELECT * FROM chat_messages
      WHERE order_id IS NULL
      ORDER BY created_at ASC
      LIMIT 300
    `).all();
    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load ops chat' });
  }
});

router.post('/', requireAuth, (req, res) => {
  try {
    const { order_id, body } = req.body || {};
    const text = String(body || '').trim();
    if (!text) return res.status(400).json({ error: 'Message required' });

    const role = req.user.role;
    if (role !== 'admin' && role !== 'driver') {
      return res.status(403).json({ error: 'Only admin and drivers can use this chat' });
    }

    if (order_id) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (role === 'driver') {
        const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
        if (!driver || order.driver_id !== driver.id) {
          return res.status(403).json({ error: 'Not assigned to this order' });
        }
      }
    }

    const id = uuid();
    db.prepare(`
      INSERT INTO chat_messages (id, order_id, sender_id, sender_role, sender_name, body)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, order_id || null, req.user.id, role, req.user.name || role, text);

    const message = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
    realtime.emit('chat:message', { message, order_id: order_id || null });
    res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
