const express = require('express');
const db = require('../db/schema');

const router = express.Router();

router.get('/', (req, res) => {
  const { category, town, q } = req.query;
  let sql = `SELECT id, name, category, description, town, delivery_fee, image_url, is_active
             FROM restaurants WHERE is_active = 1`;
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (town) {
    sql += ' AND town = ?';
    params.push(town);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY name';
  const rows = db.prepare(sql).all(...params);
  res.json({ restaurants: rows });
});

router.get('/:id', (req, res) => {
  const rest = db.prepare(
    `SELECT id, name, category, description, town, delivery_fee, image_url, is_active
     FROM restaurants WHERE id = ? AND is_active = 1`
  ).get(req.params.id);
  if (!rest) return res.status(404).json({ error: 'Restaurant not found' });

  const menu = db.prepare(
    `SELECT id, name, description, price, category, image_url, is_available
     FROM menu_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY category, name`
  ).all(req.params.id);

  res.json({ restaurant: rest, menu });
});

router.get('/meta/categories', (req, res) => {
  const rows = db.prepare(
    `SELECT DISTINCT category FROM restaurants WHERE is_active = 1 ORDER BY category`
  ).all();
  res.json({ categories: rows.map((r) => r.category) });
});

module.exports = router;
