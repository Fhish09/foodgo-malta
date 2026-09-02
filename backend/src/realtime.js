let io = null;

function init(socketIoServer) {
  io = socketIoServer;
  io.on('connection', (socket) => {
    socket.emit('hello', { service: 'FoodGo Malta', time: new Date().toISOString() });
    socket.on('join', (room) => {
      if (room === 'admin' || room === 'public') socket.join(room);
    });
  });
  console.log('Socket.IO realtime ready');
}

function emit(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

function emitAdmin(event, payload) {
  if (!io) return;
  io.to('admin').emit(event, payload);
  io.emit(event, payload);
}

module.exports = { init, emit, emitAdmin };
