require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./schema');

console.log('Seeding FoodGo Malta database...');

db.exec(`
  DELETE FROM order_items;
  DELETE FROM orders;
  DELETE FROM menu_items;
  DELETE FROM addresses;
  DELETE FROM restaurants;
  DELETE FROM users;
`);

const hash = (pw) => bcrypt.hashSync(pw, 10);

const adminId = uuid();
const owner1 = uuid();
const owner2 = uuid();
const customerId = uuid();

const insertUser = db.prepare(`
  INSERT INTO users (id, email, password_hash, name, role, phone)
  VALUES (?, ?, ?, ?, ?, ?)
`);

insertUser.run(adminId, 'admin@foodgo.mt', hash('admin123'), 'Admin User', 'admin', '+356 2100 0001');
insertUser.run(owner1, 'owner@vallettapizza.mt', hash('owner123'), 'Marco Borg', 'restaurant', '+356 2123 1001');
insertUser.run(owner2, 'owner@sliemabites.mt', hash('owner123'), 'Sarah Camilleri', 'restaurant', '+356 2133 2002');
insertUser.run(customerId, 'customer@example.com', hash('customer123'), 'John Vella', 'customer', '+356 7945 3003');

const restaurants = [
  { id: uuid(), owner_id: owner1, name: 'Valletta Pizza Co.', category: 'Pizza', description: 'Wood-fired pizzas in the heart of Valletta.', town: 'Valletta', delivery_fee: 2.0 },
  { id: uuid(), owner_id: owner2, name: 'Sliema Burger House', category: 'Burgers', description: 'Gourmet burgers with sea views.', town: 'Sliema', delivery_fee: 2.5 },
  { id: uuid(), owner_id: owner1, name: 'Maltese Kitchen', category: 'Maltese food', description: 'Traditional pastizzi, rabbit and more.', town: 'Birkirkara', delivery_fee: 2.5 },
  { id: uuid(), owner_id: owner2, name: 'St Julian Sushi', category: 'Sushi', description: 'Fresh rolls and sashimi in Paceville.', town: "St. Julian's", delivery_fee: 3.0 },
  { id: uuid(), owner_id: owner1, name: 'Healthy Bowl Malta', category: 'Healthy bowls', description: 'Fresh bowls, salads and smoothies.', town: 'Mosta', delivery_fee: 2.5 },
  { id: uuid(), owner_id: owner2, name: 'Dessert Lab', category: 'Desserts', description: 'Cakes, gelato and sweet treats.', town: 'Sliema', delivery_fee: 2.0 },
];

const insertRest = db.prepare(`
  INSERT INTO restaurants (id, owner_id, name, category, description, town, delivery_fee)
  VALUES (@id, @owner_id, @name, @category, @description, @town, @delivery_fee)
`);
for (const r of restaurants) insertRest.run(r);

const menus = {
  'Valletta Pizza Co.': [
    { name: 'Margherita', description: 'Tomato, mozzarella, basil', price: 9.5, category: 'Pizza' },
    { name: 'Pepperoni', description: 'Spicy salami, mozzarella', price: 11.5, category: 'Pizza' },
    { name: 'Truffle Funghi', description: 'Mushrooms, truffle oil', price: 13.5, category: 'Pizza' },
    { name: 'Maltese Special', description: 'Gbejniet, olives, sundried tomato', price: 12.0, category: 'Pizza' },
    { name: 'Garlic Bread', description: 'With herbs', price: 4.5, category: 'Sides' },
    { name: 'Cola', description: '330ml', price: 2.0, category: 'Drinks' },
  ],
  'Sliema Burger House': [
    { name: "Chef's Burger", description: 'Angus beef, cheddar, pickles', price: 12.5, category: 'Burgers' },
    { name: 'Chicken Burger', description: 'Crispy chicken, mayo', price: 11.0, category: 'Burgers' },
    { name: 'Veggie Burger', description: 'Plant-based patty', price: 10.5, category: 'Burgers' },
    { name: 'Loaded Fries', description: 'Cheese, bacon bits', price: 5.5, category: 'Sides' },
    { name: 'Onion Rings', description: 'Crispy battered', price: 4.5, category: 'Sides' },
    { name: 'Milkshake', description: 'Vanilla or chocolate', price: 4.0, category: 'Drinks' },
  ],
  'Maltese Kitchen': [
    { name: 'Pastizzi (3pcs)', description: 'Pea or cheese', price: 3.5, category: 'Maltese' },
    { name: 'Rabbit Stew', description: 'Fenek bit-tewm u l-inbid', price: 16.0, category: 'Maltese' },
    { name: 'Lampuki Pie', description: 'Seasonal fish pie', price: 14.0, category: 'Maltese' },
    { name: 'Ftira', description: 'Traditional filled bread', price: 8.5, category: 'Maltese' },
    { name: 'Kinnie', description: 'Local soft drink', price: 2.5, category: 'Drinks' },
    { name: 'Imqaret', description: 'Date-filled pastry', price: 3.0, category: 'Desserts' },
  ],
  'St Julian Sushi': [
    { name: 'Salmon Nigiri (4pcs)', description: 'Fresh Atlantic salmon', price: 9.0, category: 'Sushi' },
    { name: 'California Roll', description: 'Crab, avocado, cucumber', price: 10.5, category: 'Sushi' },
    { name: 'Spicy Tuna Roll', description: 'Tuna, spicy mayo', price: 11.5, category: 'Sushi' },
    { name: 'Dragon Roll', description: 'Eel, avocado, cucumber', price: 14.0, category: 'Sushi' },
    { name: 'Miso Soup', description: 'Traditional', price: 3.5, category: 'Sides' },
    { name: 'Green Tea', description: 'Hot or iced', price: 2.5, category: 'Drinks' },
  ],
  'Healthy Bowl Malta': [
    { name: 'Power Bowl', description: 'Quinoa, avocado, chickpeas', price: 11.5, category: 'Bowls' },
    { name: 'Salmon Bowl', description: 'Grilled salmon, greens', price: 14.5, category: 'Bowls' },
    { name: 'Falafel Bowl', description: 'Falafel, hummus, salad', price: 10.5, category: 'Bowls' },
    { name: 'Acai Bowl', description: 'Berries, granola', price: 9.0, category: 'Bowls' },
    { name: 'Green Smoothie', description: 'Spinach, banana, apple', price: 5.0, category: 'Drinks' },
    { name: 'Protein Shake', description: 'Whey or plant', price: 5.5, category: 'Drinks' },
  ],
  'Dessert Lab': [
    { name: 'Chocolate Lava Cake', description: 'Warm with ice cream', price: 7.5, category: 'Desserts' },
    { name: 'Tiramisu', description: 'Classic Italian', price: 6.5, category: 'Desserts' },
    { name: 'Gelato (2 scoops)', description: 'Choice of flavours', price: 4.5, category: 'Desserts' },
    { name: 'Cheesecake', description: 'New York style', price: 6.0, category: 'Desserts' },
    { name: 'Brownie', description: 'Walnut brownie', price: 4.0, category: 'Desserts' },
    { name: 'Espresso', description: 'Single or double', price: 2.0, category: 'Drinks' },
  ],
};

const insertItem = db.prepare(`
  INSERT INTO menu_items (id, restaurant_id, name, description, price, category)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const restByName = Object.fromEntries(
  db.prepare('SELECT id, name FROM restaurants').all().map((r) => [r.name, r.id])
);

for (const [restName, items] of Object.entries(menus)) {
  const rid = restByName[restName];
  if (!rid) continue;
  for (const item of items) {
    insertItem.run(uuid(), rid, item.name, item.description, item.price, item.category);
  }
}

console.log('Seed complete.');
console.log('');
console.log('Demo accounts (password in parentheses):');
console.log('  Admin:     admin@foodgo.mt (admin123)');
console.log('  Owner:     owner@vallettapizza.mt (owner123)');
console.log('  Customer:  customer@example.com (customer123)');
console.log('');
console.log(`Restaurants: ${restaurants.length}`);
console.log(`Menu items:  ${db.prepare('SELECT COUNT(*) as c FROM menu_items').get().c}`);
