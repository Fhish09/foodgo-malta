const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');
const realtime = require('../realtime');

const router = express.Router();

router.use(function (req, res, next) {
  requireAuth(req, res, function () {
    requireRole('driver', 'admin')(req, res, next);
  });
});

function myDriver(userId) {
  return db.prepare('SELECT * FROM drivers WHERE user_id = ?').get(userId);
}

router.get('/me', function (req, res) {
  try {
    const driver = myDriver(req.user.id);
    if (!driver && req.user.role === 'driver') {
      return res.status(404).json({ error: 'No driver profile linked to this account' });
    }
    res.json({ driver: driver || null, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.get('/jobs', function (req, res) {
  try {
    const driver = myDriver(req.user.id);
    if (!driver) return res.status(404).json({ error: 'Driver profile not found' });

    const jobs = db.prepare(
      "SELECT o.*, r.name AS restaurant_name, r.town AS restaurant_town, " +
      "u.name AS customer_name, u.phone AS customer_phone " +
      "FROM orders o " +
      "JOIN restaurants r ON r.id = o.restaurant_id " +
      "JOIN users u ON u.id = o.user_id " +
      "WHERE o.driver_id = ? " +
      "AND o.status IN ('confirmed','preparing','out_for_delivery','delivered') " +
      "ORDER BY CASE o.status WHEN 'out_for_delivery' THEN 0 WHEN 'preparing' THEN 1 WHEN 'confirmed' THEN 2 ELSE 3 END, o.created_at DESC LIMIT 50"
    ).all(driver.id);

    res.json({ jobs, driver });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load jobs' });
  }
});

router.patch('/jobs/:id/status', function (req, res) {
  try {
    const driver = myDriver(req.user.id);
    if (!driver) return res.status(404).json({ error: 'Driver profile not found' });

    const status = (req.body || {}).status;
    const allowed = ['out_for_delivery', 'delivered'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Use out_for_delivery or delivered' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driver.id) {
      return res.status(403).json({ error: 'Not your job' });
    }

    if (status === 'delivered') {
      db.prepare("UPDATE orders SET status = 'delivered', delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(order.id);
      db.prepare("UPDATE drivers SET status = 'available' WHERE id = ?").run(driver.id);
    } else {
      db.prepare("UPDATE orders SET status = 'out_for_delivery', updated_at = datetime('now') WHERE id = ?").run(order.id);
      db.prepare("UPDATE drivers SET status = 'on_delivery' WHERE id = ?").run(driver.id);
    }

    const updated = db.prepare(
      'SELECT o.*, r.name AS restaurant_name, u.name AS customer_name ' +
      'FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN users u ON u.id = o.user_id WHERE o.id = ?'
    ).get(order.id);

    realtime.emit('order:updated', { action: 'driver_status', order: updated });
    realtime.emit('driver:updated', { action: 'status', driverId: driver.id });
    res.json({ order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

module.exports = router;
