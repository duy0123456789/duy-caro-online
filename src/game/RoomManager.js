/**
 * src/game/RoomManager.js
 * Manages all active rooms, player sessions, matchmaking queue,
 * reconnect tokens, and spectators.
 */

const { v4: uuidv4 } = require('uuid');
const { createBoard, PLAYER_X, PLAYER_O } = require('./GameLogic');

const RECONNECT_TIMEOUT_MS = (parseInt(process.env.RECONNECT_TIMEOUT) || 30) * 1000;

/** @type {Map<string, Room>} roomId -> Room */
const rooms = new Map();

/** @type {Map<string, string>} socketId -> roomId  (for disconnect cleanup) */
const socketToRoom = new Map();

/** @type {Map<string, { roomId, mark, name, timer }>} reconnectToken -> info */
const reconnectTokens = new Map();

/** @type {string[]} matchmaking queue of socketIds */
const matchmakingQueue = [];

// ─── Room factory ────────────────────────────────────────────────────────────

function createRoom(roomId, hostSocket, hostName) {
  const room = {
    id: roomId,
    players: [
      { socketId: hostSocket, name: hostName, mark: PLAYER_X, connected: true },
    ],
    spectators: [],        // array of socketIds
    board: createBoard(),
    currentMark: PLAYER_X, // whose turn
    started: false,
    ended: false,
    moves: 0,
    chat: [],              // { from, text, ts, system }
    createdAt: Date.now(),
  };
  rooms.set(roomId, room);
  socketToRoom.set(hostSocket, roomId);
  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    room.players.forEach(p => socketToRoom.delete(p.socketId));
    room.spectators.forEach(sid => socketToRoom.delete(sid));
  }
  rooms.delete(roomId);
}

function getRoomBySocket(socketId) {
  const roomId = socketToRoom.get(socketId);
  return roomId ? rooms.get(roomId) || null : null;
}

// ─── Player helpers ───────────────────────────────────────────────────────────

function getPlayerInRoom(room, socketId) {
  return room.players.find(p => p.socketId === socketId) || null;
}

function getOpponent(room, socketId) {
  return room.players.find(p => p.socketId !== socketId) || null;
}

function joinRoom(roomId, socketId, playerName) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room does not exist' };
  if (room.ended) return { error: 'Game already ended' };
  if (room.players.length >= 2) return { error: 'Room is full' };

  const player = { socketId, name: playerName, mark: PLAYER_O, connected: true };
  room.players.push(player);
  socketToRoom.set(socketId, roomId);
  room.started = true;
  return { room, player };
}

function addSpectator(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (!room.spectators.includes(socketId)) {
    room.spectators.push(socketId);
    socketToRoom.set(socketId, roomId);
  }
  return true;
}

function removeSpectator(room, socketId) {
  room.spectators = room.spectators.filter(s => s !== socketId);
  socketToRoom.delete(socketId);
}

// ─── Reconnect ────────────────────────────────────────────────────────────────

/**
 * Issue a reconnect token when a player disconnects.
 * Returns the token string.
 */
function issueReconnectToken(roomId, mark, name) {
  const token = uuidv4();
  const timer = setTimeout(() => {
    reconnectTokens.delete(token);
  }, RECONNECT_TIMEOUT_MS);

  reconnectTokens.set(token, { roomId, mark, name, timer });
  return token;
}

/**
 * Attempt reconnect. Returns { room, player } or { error }.
 */
function attemptReconnect(token, newSocketId) {
  const info = reconnectTokens.get(token);
  if (!info) return { error: 'Reconnect token expired or invalid' };

  const room = rooms.get(info.roomId);
  if (!room) return { error: 'Room no longer exists' };

  const player = room.players.find(p => p.mark === info.mark);
  if (!player) return { error: 'Player slot not found' };

  // Clean up old socket mapping
  socketToRoom.delete(player.socketId);

  // Update player's socket
  player.socketId = newSocketId;
  player.connected = true;
  socketToRoom.set(newSocketId, info.roomId);

  // Cancel timer & remove token
  clearTimeout(info.timer);
  reconnectTokens.delete(token);

  return { room, player };
}

// ─── Matchmaking ─────────────────────────────────────────────────────────────

function enqueue(socketId) {
  if (!matchmakingQueue.includes(socketId)) {
    matchmakingQueue.push(socketId);
  }
}

function dequeue(socketId) {
  const idx = matchmakingQueue.indexOf(socketId);
  if (idx !== -1) matchmakingQueue.splice(idx, 1);
}

/**
 * Try to match two players from queue.
 * Returns { p1SocketId, p2SocketId, roomId } or null if queue < 2.
 */
function tryMatch() {
  if (matchmakingQueue.length < 2) return null;
  const p1 = matchmakingQueue.shift();
  const p2 = matchmakingQueue.shift();
  const roomId = `quick-${uuidv4().slice(0, 8)}`;
  return { p1, p2, roomId };
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

function addChatMessage(room, from, text, system = false) {
  const msg = { from, text, ts: Date.now(), system };
  room.chat.push(msg);
  if (room.chat.length > 200) room.chat.shift(); // keep last 200
  return msg;
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

function getRoomCount() { return rooms.size; }
function getQueueLength() { return matchmakingQueue.length; }

module.exports = {
  rooms,
  createRoom,
  getRoom,
  deleteRoom,
  getRoomBySocket,
  getPlayerInRoom,
  getOpponent,
  joinRoom,
  addSpectator,
  removeSpectator,
  issueReconnectToken,
  attemptReconnect,
  enqueue,
  dequeue,
  tryMatch,
  addChatMessage,
  getRoomCount,
  getQueueLength,
};
