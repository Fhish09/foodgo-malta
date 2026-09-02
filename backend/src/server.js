require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

require('./db/schema');

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const driverRoutes = require('./routes/driver');
const realtime = require('./realtime');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

const io = new Server(server, {
  cors: { origin: true, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  path: '/socket.io'
});

realtime.init(io);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'FoodGo Malta API', realtime: true, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/driver', driverRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`FoodGo API listening on http://0.0.0.0:${PORT}`);
  console.log(`Socket.IO on same port (path /socket.io)`);
  console.log(`Data dir: ${process.env.DATA_DIR || path.join(__dirname, '..', 'data')}`);
});
