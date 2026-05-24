/**
 * src/handlers/gameHandler.js
 * Handles all game-related socket events:
 *   createGame, joinGame, playTurn, requestRematch, leaveRoom
 */

const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const {
  createRoom, getRoom, deleteRoom, getRoomBySocket,
  getPlayerInRoom, getOpponent, joinRoom,
  issueReconnectToken, attemptReconnect,
  addChatMessage,
} = require('../game/RoomManager');
const {
  validateMove, applyMove, checkWinner, isBoardFull,
} = require('../game/GameLogic');

// ─── Rate-limit helper (per socket, in-memory) ────────────────────────────────
const moveCooldowns = new Map(); // socketId -> lastMoveMs

function canMove(socketId) {
  const last = moveCooldowns.get(socketId) || 0;
  const now = Date.now();
  if (now - last < 200) return false; // 200ms debounce
  moveCooldowns.set(socketId, now);
  return true;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = function registerGameHandlers(io, socket) {

  // ── Create Room ────────────────────────────────────────────────────────────
  socket.on('createGame', (data) => {
    console.log(`[createGame] Socket ${socket.id} creating game, name: ${data?.name}`);
    const name = sanitize(data?.name);
    if (!name) {
      console.log('[createGame] Error: Name is required');
      return socket.emit('err', { message: 'Name is required' });
    }

    const roomId = `room-${uuidv4().slice(0, 6)}`;
    const room = createRoom(roomId, socket.id, name);
    socket.join(roomId);
    console.log(`[createGame] Room created: ${roomId} for player: ${name}`);

    socket.emit('gameCreated', {
      room: roomId,
      name,
      mark: 'X',
    });
    systemMsg(io, room, `${name} created the room.`);
  });

  // ── Join Room ──────────────────────────────────────────────────────────────
  socket.on('joinGame', (data) => {
    console.log(`[joinGame] Socket ${socket.id} joining game, name: ${data?.name}, room: ${data?.room}`);
    const name = sanitize(data?.name);
    const roomId = sanitize(data?.room);
    if (!name || !roomId) {
      console.log('[joinGame] Error: Name and room ID required');
      return socket.emit('err', { message: 'Name and room ID required' });
    }

    const result = joinRoom(roomId, socket.id, name);
    if (result.error) {
      console.log(`[joinGame] Error: ${result.error}`);
      return socket.emit('err', { message: result.error });
    }

    const { room } = result;
    socket.join(roomId);
    console.log(`[joinGame] Player ${name} joined room ${roomId}`);

    // Tell P2 they joined
    socket.emit('gameJoined', {
      room: roomId,
      name,
      mark: 'O',
      board: room.board,
    });

    // Tell P1 opponent arrived
    const p1 = room.players[0];
    io.to(p1.socketId).emit('opponentJoined', { name, mark: 'O' });

    systemMsg(io, room, `${name} joined the room. Game started!`);
    // Tell both players whose turn it is
    io.to(roomId).emit('turnUpdate', { currentMark: room.currentMark });
  });

  // ── Spectate Room ──────────────────────────────────────────────────────────
  socket.on('spectateGame', (data) => {
    const roomId = sanitize(data?.room);
    const room = getRoom(roomId);
    if (!room) return socket.emit('err', { message: 'Room not found' });

    const { addSpectator } = require('../game/RoomManager');
    addSpectator(roomId, socket.id);
    socket.join(roomId);

    socket.emit('spectating', {
      room: roomId,
      board: room.board,
      currentMark: room.currentMark,
      players: room.players.map(p => ({ name: p.name, mark: p.mark })),
      chat: room.chat.slice(-50),
    });
    systemMsg(io, room, 'A spectator joined.');
  });

  // ── Play Turn ──────────────────────────────────────────────────────────────
  socket.on('playTurn', (data) => {
    if (!canMove(socket.id)) return; // debounce spam

    const roomId = sanitize(data?.room);
    const row = parseInt(data?.row, 10);
    const col = parseInt(data?.col, 10);

    const room = getRoom(roomId);
    if (!room) return socket.emit('err', { message: 'Room not found' });
    if (room.ended) return socket.emit('err', { message: 'Game already ended' });
    if (!room.started) return socket.emit('err', { message: 'Game not started yet' });

    const player = getPlayerInRoom(room, socket.id);
    if (!player) return socket.emit('err', { message: 'You are not a player in this room' });

    // Validate turn order
    if (player.mark !== room.currentMark) {
      return socket.emit('err', { message: 'Not your turn' });
    }

    // Validate move
    const { valid, reason } = validateMove(room.board, row, col);
    if (!valid) return socket.emit('err', { message: reason });

    // Apply move
    room.board = applyMove(room.board, row, col, player.mark);
    room.moves++;

    // Check result
    const { winner, line } = checkWinner(room.board, row, col);
    const tied = !winner && isBoardFull(room.board);

    // ── CRITICAL: broadcast the move FIRST, then game-end ──────────────────
    // Both players render the tile before any popup appears.
    io.to(roomId).emit('moveMade', {
      row, col,
      mark: player.mark,
      currentMark: room.currentMark,
    });

    if (winner) {
      room.ended = true;
      const opponent = getOpponent(room, socket.id);

      // Step 1: highlight winning line
      io.to(roomId).emit('winLine', { line });

      // Step 2: send result to each player individually
      // Small delay so client can render the move + line before dialog
      setTimeout(() => {
        socket.emit('gameResult', {
          result: 'win',
          message: `You Win! 🎉`,
          winner: player.mark,
          line,
        });
        if (opponent) {
          io.to(opponent.socketId).emit('gameResult', {
            result: 'lose',
            message: `You Lose 😔`,
            winner: player.mark,
            line,
          });
        }
        // Spectators
        room.spectators.forEach(sid => {
          io.to(sid).emit('gameResult', {
            result: 'spectate',
            message: `${player.name} (${player.mark}) wins!`,
            winner: player.mark,
            line,
          });
        });
      }, 300);

      systemMsg(io, room, `${player.name} wins!`);
      return;
    }

    if (tied) {
      room.ended = true;
      setTimeout(() => {
        io.to(roomId).emit('gameResult', {
          result: 'tie',
          message: "It's a Draw! 🤝",
          winner: null,
          line: null,
        });
      }, 300);
      systemMsg(io, room, 'Game tied!');
      return;
    }

    // Switch turn
    room.currentMark = room.currentMark === 'X' ? 'O' : 'X';
    io.to(roomId).emit('turnUpdate', { currentMark: room.currentMark });
  });

  // ── Rematch Request ────────────────────────────────────────────────────────
  socket.on('requestRematch', (data) => {
    const roomId = sanitize(data?.room);
    const room = getRoom(roomId);
    if (!room) return socket.emit('err', { message: 'Room not found' });

    const player = getPlayerInRoom(room, socket.id);
    if (!player) return;

    const opponent = getOpponent(room, socket.id);

    // Mark this player as wanting rematch
    player.wantsRematch = true;
    socket.emit('rematchPending', { message: 'Waiting for opponent…' });
    if (opponent) io.to(opponent.socketId).emit('rematchRequested', { from: player.name });

    // If both want rematch → reset
    if (room.players.every(p => p.wantsRematch)) {
      const { createBoard, PLAYER_X } = require('../game/GameLogic');
      room.board = createBoard();
      room.currentMark = PLAYER_X;
      room.ended = false;
      room.started = true;
      room.moves = 0;
      room.players.forEach(p => { p.wantsRematch = false; });

      // Swap marks for fairness
      room.players.forEach(p => {
        p.mark = p.mark === 'X' ? 'O' : 'X';
      });

      io.to(roomId).emit('rematchStart', {
        board: room.board,
        currentMark: room.currentMark,
        players: room.players.map(p => ({ name: p.name, mark: p.mark, socketId: p.socketId })),
      });
      systemMsg(io, room, 'Rematch started!');
    }
  });

  // ── Leave Room ─────────────────────────────────────────────────────────────
  socket.on('leaveRoom', (data) => {
    const roomId = sanitize(data?.room);
    handleLeave(io, socket, roomId, false);
  });

  // ── Reconnect ──────────────────────────────────────────────────────────────
  socket.on('reconnectGame', (data) => {
    const token = sanitize(data?.token);
    if (!token) return socket.emit('err', { message: 'No reconnect token' });

    const result = attemptReconnect(token, socket.id);
    if (result.error) return socket.emit('err', { message: result.error });

    const { room, player } = result;
    socket.join(room.id);

    socket.emit('reconnected', {
      room: room.id,
      mark: player.mark,
      name: player.name,
      board: room.board,
      currentMark: room.currentMark,
      chat: room.chat.slice(-50),
    });

    const opponent = getOpponent(room, socket.id);
    if (opponent) {
      io.to(opponent.socketId).emit('opponentReconnected', { name: player.name });
    }
    systemMsg(io, room, `${player.name} reconnected.`);
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return sanitizeHtml(str.trim(), { allowedTags: [], allowedAttributes: {} }).slice(0, 100);
}

function systemMsg(io, room, text) {
  const msg = addChatMessage(room, 'System', text, true);
  io.to(room.id).emit('chatMessage', msg);
}

/**
 * Called on socket disconnect OR manual leaveRoom.
 */
function handleLeave(io, socket, roomId, isDisconnect) {
  const room = getRoom(roomId);
  if (!room) return;

  const player = getPlayerInRoom(room, socket.id);

  if (player) {
    if (isDisconnect && !room.ended) {
      // Issue reconnect token
      player.connected = false;
      const token = issueReconnectToken(room.id, player.mark, player.name);
      socket.emit('reconnectToken', { token }); // may not arrive if hard disconnect
      // Store in room so rejoining client can fetch it (they send the token back)

      const opponent = getOpponent(room, socket.id);
      if (opponent) {
        io.to(opponent.socketId).emit('opponentDisconnected', {
          name: player.name,
          timeoutSeconds: parseInt(process.env.RECONNECT_TIMEOUT) || 30,
        });
      }
      systemMsg(io, room, `${player.name} disconnected. Waiting to reconnect…`);

      // If opponent also gone → clean up after timeout
      setTimeout(() => {
        const r = getRoom(roomId);
        if (r && !r.players.find(p => p.mark === player.mark)?.connected) {
          io.to(roomId).emit('opponentLeft', { name: player.name });
          deleteRoom(roomId);
        }
      }, (parseInt(process.env.RECONNECT_TIMEOUT) || 30) * 1000 + 500);

    } else {
      // Voluntary leave or game already ended
      const opponent = getOpponent(room, socket.id);
      if (opponent) {
        io.to(opponent.socketId).emit('opponentLeft', { name: player.name });
      }
      systemMsg(io, room, `${player.name} left the room.`);
      deleteRoom(roomId);
    }
  } else {
    // Spectator
    const { removeSpectator } = require('../game/RoomManager');
    removeSpectator(room, socket.id);
    systemMsg(io, room, 'A spectator left.');
  }
}

module.exports.handleLeave = handleLeave;
