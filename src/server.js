/**
 * src/server.js
 * Entry point. Sets up Express + Socket.IO v4, middleware, routes, handlers.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const registerGameHandlers = require('./handlers/gameHandler');
const { handleLeave } = require('./handlers/gameHandler');
const registerChatHandlers = require('./handlers/chatHandler');
const registerMatchmakingHandlers = require('./handlers/matchmakingHandler');
const { getRoomBySocket, dequeue, getRoomCount, getQueueLength } = require('./game/RoomManager');

// ─── Express setup ────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "ws:", "wss:"],
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit HTTP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: getRoomCount(),
    queue: getQueueLength(),
    uptime: Math.floor(process.uptime()),
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Socket.IO v4 ─────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { 
    origin: ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'], 
    methods: ['GET', 'POST'] 
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Per-socket rate limit for socket events
const socketEventCounts = new Map();
setInterval(() => socketEventCounts.clear(), 1000); // reset every second

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Middleware: rate-limit socket events to 30/sec per socket
  const originalOnEvent = socket.onevent.bind(socket);
  socket.onevent = (packet) => {
    const count = (socketEventCounts.get(socket.id) || 0) + 1;
    socketEventCounts.set(socket.id, count);
    if (count > 30) {
      socket.emit('err', { message: 'Too many requests. Slow down!' });
      return;
    }
    originalOnEvent(packet);
  };

  // Register all handlers
  registerGameHandlers(io, socket);
  registerChatHandlers(io, socket);
  registerMatchmakingHandlers(io, socket);

  // Disconnect cleanup
  socket.on('disconnect', (reason) => {
    console.log(`[disconnect] ${socket.id} — ${reason}`);
    dequeue(socket.id); // remove from matchmaking if queued

    const room = getRoomBySocket(socket.id);
    if (room) {
      handleLeave(io, socket, room.id, true);
    }
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        🎮 Caro Online - Gomoku 15×15 Server              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`[INFO] Server running on port ${PORT}`);
  console.log(`[INFO] Socket.IO v4 configured with cors for:`, 
    'http://localhost:3000, http://localhost:5500');
  console.log(`[INFO] Transports: websocket + polling`);
  console.log(`[INFO] Ready to accept connections...`);
  console.log('────────────────────────────────────────────────────────────');
});

process.on('uncaughtException', (err) => console.error('Uncaught:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
