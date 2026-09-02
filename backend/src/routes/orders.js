const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/schema');
const auth = require('../middleware/auth');
const realtime = require('../realtime');

const router = express.Router();

const TOWN_FEES = {
  Valletta: 1.5,
  Floriana: 1.5,
  Sliema: 2.0,
  "St. Julian's": 2.5,
  Gzira: 2.0,
  Msida: 2.0,
  Birkirkara: 2.5,
  Mosta: 2.5,
  Qormi: 2.5,
  Other: 3.5
};

function feeForTown(town) {
  if (!town) return TOWN_FEES.Other;
  var key = Object.keys(TOWN_FEES).find(function (k) {
    return k.toLowerCase() === String(town).toLowerCase();
  });
  return key ? TOWN_FEES[key] : TOWN_FEES.Other;
}

function withAuth(handler) {
  return function (req, res) {
    auth.requireAuth(req, res, function () {
      handler(req, res);
    });
  };
}

router.post('/', withAuth(function (req, res) {
  try {
    var body = req.body || {};
    var restaurant_id = body.restaurant_id;
    var items = body.items;
    var delivery_town = body.delivery_town;
    var delivery_street = body.delivery_street;
    var delivery_notes = body.delivery_notes;
    var payment_method = body.payment_method;

    if (!restaurant_id || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Restaurant and items are required' });
    }
    if (!delivery_street || !delivery_town) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }

    var rest = db.prepare('SELECT id FROM restaurants WHERE id = ?').get(restaurant_id);
    if (!rest) return res.status(404).json({ error: 'Restaurant not found' });

    var subtotal = 0;
    var normalized = items.map(function (it) {
      var qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      var price = Number(it.unit_price);
      if (!it.name || isNaN(price)) throw new Error('Invalid item');
      subtotal += price * qty;
      return {
        id: uuid(),
        menu_item_id: it.menu_item_id || null,
        name: String(it.name),
        unit_price: price,
        quantity: qty
      };
    });

    var delivery_fee = feeForTown(delivery_town);
    if (subtotal >= 25) delivery_fee = 0;
    var total = Math.round((subtotal + delivery_fee) * 100) / 100;

    var orderId = uuid();
    var insertOrder = db.prepare(
      'INSERT INTO orders (id, user_id, restaurant_id, status, subtotal, delivery_fee, total, delivery_town, delivery_street, delivery_notes, payment_method) VALUES (?, ?, ?, \'pending\', ?, ?, ?, ?, ?, ?, ?)'
    );
    var insertItem = db.prepare(
      'INSERT INTO order_items (id, order_id, menu_item_id, name, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)'
    );

    var runTx = db.transaction(function () {
      insertOrder.run(
        orderId,
        req.user.id,
        restaurant_id,
        subtotal,
        delivery_fee,
        total,
        delivery_town,
        delivery_street,
        delivery_notes || null,
        payment_method || 'card'
      );
      normalized.forEach(function (it) {
        insertItem.run(it.id, orderId, it.menu_item_id, it.name, it.unit_price, it.quantity);
      });
    });
    runTx();

    var order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    var orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    try {
      realtime.emit('order:created', { order: order, items: orderItems });
    } catch (e) {}
    res.status(201).json({ order: order, items: orderItems });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: err.message || 'Failed to create order' });
  }
}));

router.get('/mine', withAuth(function (req, res) {
  try {
    var orders = db.prepare(
      'SELECT o.*, r.name AS restaurant_name FROM orders o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 50'
    ).all(req.user.id);
    res.json({ orders: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
}));

router.get('/:id', withAuth(function (req, res) {
  try {
    var order = db.prepare(
      'SELECT o.*, r.name AS restaurant_name FROM orders o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.id = ?'
    ).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    var items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ order: order, items: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load order' });
  }
}));

router.post('/:id/tip', withAuth(function (req, res) {
  try {
    var order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    var body = req.body || {};
    var tip_driver = Math.max(0, Number(body.tip_driver) || 0);
    var tip_company = Math.max(0, Number(body.tip_company) || 0);
    db.prepare("UPDATE orders SET tip_driver = ?, tip_company = ?, updated_at = datetime('now') WHERE id = ?").run(tip_driver, tip_company, order.id);
    var updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    try {
      realtime.emit('order:updated', { action: 'tip', order: updated });
    } catch (e) {}
    res.json({ order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save tip' });
  }
}));

module.exports = router;
