/**
 * src/handlers/matchmakingHandler.js
 * Quick-match / random room assignment.
 */

const sanitizeHtml = require('sanitize-html');
const { enqueue, dequeue, tryMatch, createRoom, joinRoom } = require('../game/RoomManager');

module.exports = function registerMatchmakingHandlers(io, socket) {

  socket.on('quickMatch', (data) => {
    const name = sanitize(data?.name);
    if (!name) return socket.emit('err', { message: 'Name required for quick match' });

    // Store name on socket for later retrieval
    socket.playerName = name;
    enqueue(socket.id);
    socket.emit('matchmaking', { status: 'searching', message: 'Searching for opponent…' });

    const match = tryMatch();
    if (!match) return; // still waiting

    const { p1, p2, roomId } = match;

    // Get names (both sockets should have playerName set)
    const p1Socket = io.sockets.sockets.get(p1);
    const p2Socket = io.sockets.sockets.get(p2);
    if (!p1Socket || !p2Socket) return; // one disconnected

    const p1Name = p1Socket.playerName || 'Player1';
    const p2Name = p2Socket.playerName || 'Player2';

    // Create room with p1 as host
    const room = createRoom(roomId, p1, p1Name);
    p1Socket.join(roomId);

    // Join p2
    joinRoom(roomId, p2, p2Name);
    p2Socket.join(roomId);

    // Notify both
    p1Socket.emit('matchFound', { room: roomId, name: p1Name, mark: 'X', opponent: p2Name });
    p2Socket.emit('matchFound', { room: roomId, name: p2Name, mark: 'O', opponent: p1Name });

    io.to(roomId).emit('turnUpdate', { currentMark: 'X' });
  });

  socket.on('cancelMatchmaking', () => {
    dequeue(socket.id);
    socket.emit('matchmaking', { status: 'cancelled' });
  });
};

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return sanitizeHtml(str.trim(), { allowedTags: [], allowedAttributes: {} }).slice(0, 100);
}
