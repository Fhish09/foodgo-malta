const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');
const realtime = require('../realtime');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/stats', (_req, res) => {
  try {
    const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const restaurants = db.prepare('SELECT COUNT(*) AS c FROM restaurants').get().c;
    const menuItems = db.prepare('SELECT COUNT(*) AS c FROM menu_items').get().c;
    const orders = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
    const revenue = db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status != 'cancelled'").get().s;
    const activePromos = db.prepare('SELECT COUNT(*) AS c FROM promos WHERE active = 1').get().c;
    res.json({ users, restaurants, menuItems, orders, revenue: Math.round(Number(revenue) * 100) / 100, activePromos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/restaurants', (_req, res) => {
  try {
    const rows = db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM menu_items m WHERE m.restaurant_id = r.id) AS item_count FROM restaurants r ORDER BY r.name`).all();
    res.json({ restaurants: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load restaurants' });
  }
});

router.patch('/restaurants/:id', (req, res) => {
  try {
    const { name, category, description, town, delivery_fee, is_active } = req.body || {};
    const existing = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Restaurant not found' });
    db.prepare(`UPDATE restaurants SET name = COALESCE(?, name), category = COALESCE(?, category), description = COALESCE(?, description), town = COALESCE(?, town), delivery_fee = COALESCE(?, delivery_fee), is_active = COALESCE(?, is_active) WHERE id = ?`).run(name ?? null, category ?? null, description ?? null, town ?? null, delivery_fee != null ? Number(delivery_fee) : null, is_active != null ? (is_active ? 1 : 0) : null, req.params.id);
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
    realtime.emit('restaurant:updated', { action: 'update', restaurant });
    res.json({ restaurant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

router.get('/menu', (_req, res) => {
  try {
    const items = db.prepare(`SELECT m.*, r.name AS restaurant_name FROM menu_items m JOIN restaurants r ON r.id = m.restaurant_id ORDER BY r.name, m.category, m.name`).all();
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load menu' });
  }
});

router.post('/menu', (req, res) => {
  try {
    const { restaurant_id, name, description, price, category, is_available } = req.body || {};
    if (!restaurant_id || !name || price == null) return res.status(400).json({ error: 'restaurant_id, name, price required' });
    const id = uuid();
    db.prepare(`INSERT INTO menu_items (id, restaurant_id, name, description, price, category, is_available) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, restaurant_id, String(name).trim(), description || '', Number(price), category || 'Main', is_available === 0 || is_available === false ? 0 : 1);
    const item = db.prepare(`SELECT m.*, r.name AS restaurant_name FROM menu_items m JOIN restaurants r ON r.id = m.restaurant_id WHERE m.id = ?`).get(id);
    realtime.emit('menu:updated', { action: 'create', item });
    res.status(201).json({ item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

router.patch('/menu/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    const { name, description, price, category, is_available } = req.body || {};
    db.prepare(`UPDATE menu_items SET name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price), category = COALESCE(?, category), is_available = COALESCE(?, is_available) WHERE id = ?`).run(name != null ? String(name).trim() : null, description != null ? String(description) : null, price != null ? Number(price) : null, category != null ? String(category) : null, is_available != null ? (is_available ? 1 : 0) : null, req.params.id);
    const item = db.prepare(`SELECT m.*, r.name AS restaurant_name FROM menu_items m JOIN restaurants r ON r.id = m.restaurant_id WHERE m.id = ?`).get(req.params.id);
    realtime.emit('menu:updated', { action: 'update', item });
    res.json({ item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

router.delete('/menu/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
    realtime.emit('menu:updated', { action: 'delete', id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

router.get('/promos', (_req, res) => {
  try {
    const promos = db.prepare('SELECT * FROM promos ORDER BY active DESC, created_at DESC').all();
    res.json({ promos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load promos' });
  }
});

router.post('/promos', (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_order, active } = req.body || {};
    if (!code || !discount_type || discount_value == null) return res.status(400).json({ error: 'code, discount_type, discount_value required' });
    const id = uuid();
    db.prepare(`INSERT INTO promos (id, code, description, discount_type, discount_value, min_order, active) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, String(code).trim().toUpperCase(), description || '', discount_type, Number(discount_value), min_order != null ? Number(min_order) : 0, active === 0 || active === false ? 0 : 1);
    const promo = db.prepare('SELECT * FROM promos WHERE id = ?').get(id);
    realtime.emit('promo:updated', { action: 'create', promo });
    res.status(201).json({ promo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create promo' });
  }
});

router.patch('/promos/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM promos WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Promo not found' });
    const { code, description, discount_type, discount_value, min_order, active } = req.body || {};
    db.prepare(`UPDATE promos SET code = COALESCE(?, code), description = COALESCE(?, description), discount_type = COALESCE(?, discount_type), discount_value = COALESCE(?, discount_value), min_order = COALESCE(?, min_order), active = COALESCE(?, active) WHERE id = ?`).run(code != null ? String(code).trim().toUpperCase() : null, description != null ? String(description) : null, discount_type ?? null, discount_value != null ? Number(discount_value) : null, min_order != null ? Number(min_order) : null, active != null ? (active ? 1 : 0) : null, req.params.id);
    const promo = db.prepare('SELECT * FROM promos WHERE id = ?').get(req.params.id);
    realtime.emit('promo:updated', { action: 'update', promo });
    res.json({ promo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update promo' });
  }
});

router.delete('/promos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM promos WHERE id = ?').run(req.params.id);
    realtime.emit('promo:updated', { action: 'delete', id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete promo' });
  }
});

router.get('/orders', (_req, res) => {
  try {
    const orders = db.prepare(`SELECT o.*, r.name AS restaurant_name, u.name AS customer_name, u.phone AS customer_phone, d.name AS driver_name, d.phone AS driver_phone FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN users u ON u.id = o.user_id LEFT JOIN drivers d ON d.id = o.driver_id ORDER BY o.created_at DESC LIMIT 100`).all();
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.patch('/orders/:id/status', (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    realtime.emit('order:updated', { action: 'status', order });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

router.get('/drivers', (_req, res) => {
  try {
    const drivers = db.prepare('SELECT * FROM drivers ORDER BY active DESC, name').all();
    res.json({ drivers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load drivers' });
  }
});

router.post('/drivers', (req, res) => {
  try {
    const { name, phone, vehicle, status } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuid();
    db.prepare(`INSERT INTO drivers (id, name, phone, vehicle, status, active) VALUES (?, ?, ?, ?, ?, 1)`).run(id, String(name).trim(), phone || '', vehicle || 'Scooter', status || 'available');
    const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
    realtime.emit('driver:updated', { action: 'create', driver });
    res.status(201).json({ driver });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

router.patch('/drivers/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Driver not found' });
    const { name, phone, vehicle, status, active } = req.body || {};
    db.prepare(`UPDATE drivers SET name = COALESCE(?, name), phone = COALESCE(?, phone), vehicle = COALESCE(?, vehicle), status = COALESCE(?, status), active = COALESCE(?, active) WHERE id = ?`).run(name != null ? String(name).trim() : null, phone != null ? String(phone).trim() : null, vehicle != null ? String(vehicle).trim() : null, status ?? null, active != null ? (active ? 1 : 0) : null, req.params.id);
    const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id);
    realtime.emit('driver:updated', { action: 'update', driver });
    res.json({ driver });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update driver' });
  }
});

router.post('/orders/:id/assign', (req, res) => {
  try {
    const { driver_id, driver_notes } = req.body || {};
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (driver_id) {
      const driver = db.prepare('SELECT * FROM drivers WHERE id = ? AND active = 1').get(driver_id);
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      db.prepare(`UPDATE orders SET driver_id = ?, driver_notes = COALESCE(?, driver_notes), status = CASE WHEN status IN ('pending','confirmed') THEN 'out_for_delivery' ELSE status END, updated_at = datetime('now') WHERE id = ?`).run(driver_id, driver_notes || null, req.params.id);
      db.prepare(`UPDATE drivers SET status = 'on_delivery' WHERE id = ?`).run(driver_id);
    } else {
      db.prepare(`UPDATE orders SET driver_id = NULL, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    }
    const updated = db.prepare(`SELECT o.*, r.name AS restaurant_name, u.name AS customer_name, d.name AS driver_name, d.phone AS driver_phone FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN users u ON u.id = o.user_id LEFT JOIN drivers d ON d.id = o.driver_id WHERE o.id = ?`).get(req.params.id);
    realtime.emit('order:updated', { action: 'assign', order: updated });
    realtime.emit('driver:updated', { action: 'assign' });
    res.json({ order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign driver' });
  }
});

module.exports = router;
