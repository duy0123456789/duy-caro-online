/**
 * src/handlers/chatHandler.js
 * Handles realtime chat inside a game room.
 */

const sanitizeHtml = require('sanitize-html');
const { getRoom, getPlayerInRoom, addChatMessage } = require('../game/RoomManager');

module.exports = function registerChatHandlers(io, socket) {

  socket.on('sendChat', (data) => {
    const roomId = sanitize(data?.room);
    const text = sanitize(data?.text);
    if (!roomId || !text) return;

    const room = getRoom(roomId);
    if (!room) return;

    // Identify sender (player or spectator)
    const player = getPlayerInRoom(room, socket.id);
    const from = player ? player.name : 'Spectator';

    const msg = addChatMessage(room, from, text, false);
    io.to(roomId).emit('chatMessage', msg);
  });
};

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return sanitizeHtml(str.trim(), { allowedTags: [], allowedAttributes: {} }).slice(0, 300);
}
