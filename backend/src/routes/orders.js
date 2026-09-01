const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/schema');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

const SERVICE_CHARGE_RATE = 0.05; // 5%

// POST /api/orders  (customer)
router.post('/', authRequired, requireRole('customer'), (req, res) => {
  const {
    restaurant_id,
    items,
    delivery_town,
    delivery_street,
    delivery_time = 'ASAP',
    payment_method = 'card',
    notes,
  } = req.body || {};

  if (!restaurant_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'restaurant_id and items are required' });
  }

  const rest = db.prepare('SELECT * FROM restaurants WHERE id = ? AND is_active = 1').get(restaurant_id);
  if (!rest) return res.status(404).json({ error: 'Restaurant not found' });

  let subtotal = 0;
  const resolved = [];
  for (const it of items) {
    const menu = db.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?').get(it.menu_item_id, restaurant_id);
    if (!menu || !menu.is_available) {
      return res.status(400).json({ error: `Invalid menu item: ${it.menu_item_id}` });
    }
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    subtotal += menu.price * qty;
    resolved.push({
      menu_item_id: menu.id,
      name: menu.name,
      unit_price: menu.price,
      quantity: qty,
      customizations: it.customizations ? JSON.stringify(it.customizations) : null,
    });
  }

  const delivery_fee = rest.delivery_fee;
  const service_charge = Math.round(subtotal * SERVICE_CHARGE_RATE * 100) / 100;
  const total = Math.round((subtotal + delivery_fee + service_charge) * 100) / 100;
  const orderId = uuid();

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, customer_id, restaurant_id, status, subtotal, delivery_fee, service_charge, total,
      delivery_town, delivery_street, delivery_time, payment_method, notes
    ) VALUES (?, ?, ?, 'placed', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (id, order_id, menu_item_id, name, unit_price, quantity, customizations)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    insertOrder.run(
      orderId,
      req.user.id,
      restaurant_id,
      subtotal,
      delivery_fee,
      service_charge,
      total,
      delivery_town || rest.town,
      delivery_street || null,
      delivery_time,
      payment_method,
      notes || null
    );
    for (const it of resolved) {
      insertItem.run(uuid(), orderId, it.menu_item_id, it.name, it.unit_price, it.quantity, it.customizations);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  res.status(201).json({ order, items: orderItems });
});

// GET /api/orders/mine  (customer)
router.get('/mine', authRequired, requireRole('customer'), (req, res) => {
  const orders = db.prepare(
    `SELECT o.*, r.name as restaurant_name
     FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
     WHERE o.customer_id = ? ORDER BY o.created_at DESC`
  ).all(req.user.id);
  res.json({ orders });
});

// GET /api/orders/restaurant/incoming  (restaurant owner) — must be before /:id
router.get('/restaurant/incoming', authRequired, requireRole('restaurant'), (req, res) => {
  const orders = db.prepare(
    `SELECT o.*, u.name as customer_name
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     JOIN users u ON u.id = o.customer_id
     WHERE r.owner_id = ?
     ORDER BY o.created_at DESC`
  ).all(req.user.id);
  res.json({ orders });
});

// GET /api/orders/:id
router.get('/:id', authRequired, (req, res) => {
  const order = db.prepare(
    `SELECT o.*, r.name as restaurant_name
     FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
     WHERE o.id = ?`
  ).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user.role === 'restaurant') {
    const rest = db.prepare('SELECT owner_id FROM restaurants WHERE id = ?').get(order.restaurant_id);
    if (!rest || rest.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ order, items });
});

// PATCH /api/orders/:id/status  (restaurant or admin)
router.patch('/:id/status', authRequired, requireRole('restaurant', 'admin'), (req, res) => {
  const { status } = req.body || {};
  const allowed = ['accepted', 'rejected', 'courier_assigned', 'on_the_way', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (req.user.role === 'restaurant') {
    const rest = db.prepare('SELECT owner_id FROM restaurants WHERE id = ?').get(order.restaurant_id);
    if (!rest || rest.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, order.id);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  res.json({ order: updated });
});

module.exports = router;
