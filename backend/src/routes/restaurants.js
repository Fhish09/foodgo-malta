const express = require('express');
const db = require('../db/schema');

const router = express.Router();

router.get('/', function (req, res) {
  try {
    const rows = db.prepare(
      'SELECT id, name, category, description, town, delivery_fee, is_active FROM restaurants WHERE is_active = 1 ORDER BY name'
    ).all();
    res.json({ restaurants: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load restaurants' });
  }
});

router.get('/:id', function (req, res) {
  try {
    const restaurant = db.prepare(
      'SELECT id, name, category, description, town, delivery_fee FROM restaurants WHERE id = ? AND is_active = 1'
    ).get(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const menu = db.prepare(
      'SELECT id, name, description, price, category, is_available FROM menu_items WHERE restaurant_id = ? ORDER BY is_available DESC, category, name'
    ).all(req.params.id);

    res.json({ restaurant: restaurant, menu: menu });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load restaurant' });
  }
});

module.exports = router;
