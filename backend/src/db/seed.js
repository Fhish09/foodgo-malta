const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./schema');

console.log('Seeding FoodGo Malta database...');
console.log('DB file:', db.dbPath);

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount > 0 && process.env.FORCE_SEED !== '1') {
  console.log('Database already has ' + userCount + ' user(s). Skipping seed.');
  console.log('Set FORCE_SEED=1 to re-seed (wipes data).');
  process.exit(0);
}

db.exec(`
  DELETE FROM chat_messages;
  DELETE FROM order_items;
  DELETE FROM orders;
  DELETE FROM menu_items;
  DELETE FROM addresses;
  DELETE FROM promos;
  DELETE FROM drivers;
  DELETE FROM restaurants;
  DELETE FROM users;
`);

const hash = function (pw) { return bcrypt.hashSync(pw, 10); };

const adminId = uuid();
const owner1 = uuid();
const owner2 = uuid();
const customerId = uuid();
const driverUserId = uuid();

const insertUser = db.prepare(
  'INSERT INTO users (id, email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?, ?)'
);

insertUser.run(adminId, 'admin@foodgo.mt', hash('admin123'), 'Admin User', 'admin', '+356 2100 0001');
insertUser.run(owner1, 'owner@vallettapizza.mt', hash('owner123'), 'Marco Borg', 'restaurant', '+356 2123 1001');
insertUser.run(owner2, 'owner@sliemabites.mt', hash('owner123'), 'Sarah Camilleri', 'restaurant', '+356 2133 2002');
insertUser.run(customerId, 'customer@example.com', hash('customer123'), 'John Vella', 'customer', '+356 7945 3003');
insertUser.run(driverUserId, 'driver@foodgo.mt', hash('driver123'), 'Luke Sammut', 'driver', '+356 7900 1001');

const restaurants = [
  { id: uuid(), owner_id: owner1, name: 'Valletta Pizza Co.', category: 'Pizza', description: 'Wood-fired pizzas in the heart of Valletta.', town: 'Valletta', delivery_fee: 2.0 },
  { id: uuid(), owner_id: owner2, name: 'Sliema Burger House', category: 'Burgers', description: 'Gourmet burgers with sea views.', town: 'Sliema', delivery_fee: 2.5 },
  { id: uuid(), owner_id: owner1, name: 'Maltese Kitchen', category: 'Maltese food', description: 'Traditional pastizzi, rabbit and more.', town: 'Birkirkara', delivery_fee: 2.5 },
  { id: uuid(), owner_id: owner2, name: "St Julian Sushi", category: 'Sushi', description: 'Fresh rolls and sashimi.', town: "St. Julian's", delivery_fee: 3.0 },
  { id: uuid(), owner_id: owner1, name: 'Healthy Bowl Malta', category: 'Healthy bowls', description: 'Fresh bowls and smoothies.', town: 'Mosta', delivery_fee: 2.5 },
  { id: uuid(), owner_id: owner2, name: 'Dessert Lab', category: 'Desserts', description: 'Cakes and gelato.', town: 'Sliema', delivery_fee: 2.5 }
];

const insertRest = db.prepare(
  'INSERT INTO restaurants (id, owner_id, name, category, description, town, delivery_fee) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
restaurants.forEach(function (r) {
  insertRest.run(r.id, r.owner_id, r.name, r.category, r.description, r.town, r.delivery_fee);
});

const menus = {
  'Valletta Pizza Co.': [
    { name: 'Margherita', description: 'Tomato, mozzarella, basil', price: 9.5, category: 'Pizza' },
    { name: 'Pepperoni', description: 'Spicy salami', price: 11.0, category: 'Pizza' },
    { name: 'Quattro Formaggi', description: 'Four cheese', price: 12.0, category: 'Pizza' },
    { name: 'Garlic Bread', description: 'With herbs', price: 4.0, category: 'Sides' }
  ],
  'Sliema Burger House': [
    { name: 'Classic Burger', description: 'Beef, cheese, salad', price: 10.5, category: 'Burgers' },
    { name: 'Chicken Burger', description: 'Crispy chicken', price: 10.0, category: 'Burgers' },
    { name: 'Fries', description: 'Sea salt', price: 3.5, category: 'Sides' }
  ],
  'Maltese Kitchen': [
    { name: 'Pastizzi (3pcs)', description: 'Pea or cheese', price: 3.0, category: 'Maltese' },
    { name: 'Rabbit Stew', description: 'Fenek stuffat', price: 14.5, category: 'Mains' },
    { name: 'Lampuki Pie', description: 'Seasonal fish pie', price: 12.0, category: 'Mains' }
  ],
  'St Julian Sushi': [
    { name: 'Salmon Nigiri', description: '4 pieces', price: 8.5, category: 'Sushi' },
    { name: 'California Roll', description: '8 pieces', price: 9.0, category: 'Sushi' }
  ],
  'Healthy Bowl Malta': [
    { name: 'Avocado Bowl', description: 'Quinoa, greens', price: 11.5, category: 'Bowls' },
    { name: 'Salmon Bowl', description: 'Grilled salmon', price: 14.5, category: 'Bowls' }
  ],
  'Dessert Lab': [
    { name: 'Chocolate Lava Cake', description: 'With ice cream', price: 7.5, category: 'Desserts' },
    { name: 'Tiramisu', description: 'Classic', price: 6.5, category: 'Desserts' }
  ]
};

const insertItem = db.prepare(
  'INSERT INTO menu_items (id, restaurant_id, name, description, price, category) VALUES (?, ?, ?, ?, ?, ?)'
);
const restByName = {};
db.prepare('SELECT id, name FROM restaurants').all().forEach(function (r) {
  restByName[r.name] = r.id;
});
Object.keys(menus).forEach(function (restName) {
  var rid = restByName[restName];
  if (!rid) return;
  menus[restName].forEach(function (item) {
    insertItem.run(uuid(), rid, item.name, item.description, item.price, item.category);
  });
});

try {
  var insertDriver = db.prepare(
    'INSERT INTO drivers (id, name, phone, vehicle, status, active, user_id) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  insertDriver.run(uuid(), 'Luke Sammut', '+356 7900 1001', 'Scooter', 'available', driverUserId);
  insertDriver.run(uuid(), 'Maria Galea', '+356 7900 1002', 'Car', 'available', null);
  insertDriver.run(uuid(), 'Joe Abela', '+356 7900 1003', 'E-bike', 'offline', null);
  console.log('Drivers: 3');
} catch (e) {
  console.log('Drivers seed skipped:', e.message);
}

console.log('Users: admin, owners, customer, driver');
console.log('Restaurants + menu items seeded.');
console.log('');
console.log('Demo accounts (password in parentheses):');
console.log('  Admin:     admin@foodgo.mt (admin123)');
console.log('  Customer:  customer@example.com (customer123)');
console.log('  Driver:    driver@foodgo.mt (driver123)');
console.log('');
console.log('Done.');
