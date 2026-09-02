/**
 * SQLite via Node built-in `node:sqlite` (no native compile — works on Windows).
 * Requires Node.js 22+.
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'foodgo.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','restaurant','admin','driver')),
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    town TEXT,
    delivery_fee REAL NOT NULL DEFAULT 2.5,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT,
    is_available INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT,
    street TEXT NOT NULL,
    town TEXT NOT NULL,
    notes TEXT,
    is_default INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','confirmed','preparing','out_for_delivery','delivered','cancelled')),
    subtotal REAL NOT NULL,
    delivery_fee REAL NOT NULL,
    total REAL NOT NULL,
    delivery_town TEXT,
    delivery_street TEXT,
    delivery_notes TEXT,
    payment_method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id TEXT,
    name TEXT NOT NULL,
    unit_price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    vehicle TEXT,
    status TEXT NOT NULL DEFAULT 'available'
      CHECK(status IN ('available','on_delivery','offline')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS promos (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'percent'
      CHECK(discount_type IN ('percent','fixed','free_delivery')),
    discount_value REAL NOT NULL DEFAULT 0,
    min_order REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    starts_at TEXT,
    ends_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu_items(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
`);

try { db.exec('ALTER TABLE orders ADD COLUMN driver_id TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE orders ADD COLUMN driver_notes TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE orders ADD COLUMN tip_driver REAL DEFAULT 0'); } catch (_) {}
try { db.exec('ALTER TABLE orders ADD COLUMN tip_company REAL DEFAULT 0'); } catch (_) {}
try { db.exec('ALTER TABLE orders ADD COLUMN delivered_at TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE drivers ADD COLUMN user_id TEXT'); } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    sender_name TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_chat_order ON chat_messages(order_id);
  CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
`);

function prepare(sql) {
  const stmt = db.prepare(sql);
  return {
    run(...params) {
      const r = stmt.run(...params);
      return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
    },
    get(...params) {
      return stmt.get(...params);
    },
    all(...params) {
      return stmt.all(...params);
    }
  };
}

function exec(sql) {
  return db.exec(sql);
}

function transaction(fn) {
  return function (...args) {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw e;
    }
  };
}

module.exports = { prepare, exec, transaction, dbPath };
