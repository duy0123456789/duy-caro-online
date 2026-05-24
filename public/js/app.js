/**
 * public/js/app.js
 * Caro Online — Complete client.
 *
 * Architecture:
 *   State      – single source of truth object
 *   Board      – canvas renderer (15×15 grid, pieces, win line)
 *   Socket     – all socket.io event registration
 *   UI         – DOM helpers, modals, overlays, chat
 *   Lobby      – lobby button handlers
 */

'use strict';

console.log('[DEBUG] app.js loaded');

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════════════════════
const BOARD_SIZE   = 15;
const CELL_SIZE    = () => Math.floor(Math.min(
  (window.innerWidth  - (window.innerWidth  > 900 ? 480 : 32)) / BOARD_SIZE,
  (window.innerHeight - (window.innerWidth  > 900 ? 80  : 220)) / BOARD_SIZE,
  42
));

// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════
const state = {
  screen:        'lobby',   // 'lobby' | 'game'
  role:          null,      // 'player' | 'spectator'
  mark:          null,      // 'X' | 'O' | null
  room:          null,
  myName:        null,
  opponentName:  null,
  board:         createEmptyBoard(),
  currentMark:   'X',
  myTurn:        false,
  gameEnded:     false,
  reconnectToken: null,
  waitingForOpponent: true,
};

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(''));
}

// ══════════════════════════════════════════════════════════════════════════════
// CANVAS BOARD
// ══════════════════════════════════════════════════════════════════════════════
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let cellSize = 36;
let winLine  = null;   // [{row,col}] to highlight

function resizeCanvas() {
  cellSize = CELL_SIZE();
  const size = cellSize * BOARD_SIZE;
  canvas.width  = size;
  canvas.height = size;
  drawBoard();
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawBoard() {
  const size = cellSize * BOARD_SIZE;
  ctx.clearRect(0, 0, size, size);

  // Background
  ctx.fillStyle = cssVar('--bg3') || '#1e2435';
  ctx.fillRect(0, 0, size, size);

  // Grid lines
  ctx.strokeStyle = cssVar('--board-lines') || '#3a4260';
  ctx.lineWidth = 1;
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const pos = i * cellSize;
    ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(size, pos); ctx.stroke();
  }

  // Pieces
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c]) drawPiece(r, c, state.board[r][c]);
    }
  }

  // Win line highlight
  if (winLine) {
    winLine.forEach(({ row, col }) => {
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      const r = cellSize * 0.38;
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = cssVar('--win-line') || '#fbbf24';
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Line through winning cells
    if (winLine.length >= 2) {
      const first = winLine[0], last = winLine[winLine.length - 1];
      ctx.beginPath();
      ctx.moveTo(first.col * cellSize + cellSize / 2, first.row * cellSize + cellSize / 2);
      ctx.lineTo(last.col  * cellSize + cellSize / 2, last.row  * cellSize + cellSize / 2);
      ctx.strokeStyle = cssVar('--win-line') || '#fbbf24';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
}

function drawPiece(row, col, mark) {
  const x = col * cellSize + cellSize / 2;
  const y = row * cellSize + cellSize / 2;
  const r = cellSize * 0.38;

  if (mark === 'X') {
    ctx.strokeStyle = cssVar('--x-color') || '#f87171';
    ctx.lineWidth = Math.max(2, cellSize * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke();
  } else {
    ctx.strokeStyle = cssVar('--o-color') || '#60a5fa';
    ctx.lineWidth = Math.max(2, cellSize * 0.1);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Canvas click → compute cell
canvas.addEventListener('click', (e) => {
  if (!state.myTurn || state.gameEnded || state.role !== 'player') return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top)  * scaleY;

  const col = Math.floor(px / cellSize);
  const row = Math.floor(py / cellSize);

  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
  if (state.board[row][col] !== '') return;

  socket.emit('playTurn', { room: state.room, row, col });
  state.myTurn = false; // optimistically block
  updateTurnUI();
});

// Touch support
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  canvas.dispatchEvent(new MouseEvent('click', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  }));
}, { passive: false });

// ══════════════════════════════════════════════════════════════════════════════
// SOCKET
// ══════════════════════════════════════════════════════════════════════════════
console.log('[DEBUG] Attempting to initialize socket.io...');
const socket = io('http://localhost:3000', { transports: ['websocket', 'polling'] });
console.log('[DEBUG] Socket.io object created:', socket);

socket.on('connect', () => {
  console.log('[DEBUG] Socket connected:', socket.id);
  const token = sessionStorage.getItem('reconnectToken');
  if (token && state.room) {
    console.log('[DEBUG] Attempting to reconnect with token');
    socket.emit('reconnectGame', { token });
  }
});

// ── Room created (P1) ─────────────────────────────────────────────────────────
socket.on('gameCreated', (data) => {
  console.log('[DEBUG] gameCreated event received:', data);
  state.room        = data.room;
  state.mark        = data.mark;
  state.myName      = data.name;
  state.role        = 'player';
  state.waitingForOpponent = true;
  switchScreen('game');
  UI.setRoomId(data.room);
  UI.setPlayerName('X', data.name);
  UI.showWaiting(data.room);
  UI.setStatus('Waiting for opponent…');
});

// ── Joined (P2) ───────────────────────────────────────────────────────────────
socket.on('gameJoined', (data) => {
  console.log('[DEBUG] gameJoined event received:', data);
  state.room        = data.room;
  state.mark        = data.mark;
  state.myName      = data.name;
  state.role        = 'player';
  state.board       = data.board || createEmptyBoard();
  state.waitingForOpponent = false;
  switchScreen('game');
  UI.setRoomId(data.room);
  UI.setPlayerName('O', data.name);
  UI.hideWaiting();
  drawBoard();
});

socket.on('disconnect', () => {
  console.log('[DEBUG] Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.error('[DEBUG] Socket connection error:', error);
});

// ── Quick match found ─────────────────────────────────────────────────────────
socket.on('matchFound', (data) => {
  state.room        = data.room;
  state.mark        = data.mark;
  state.myName      = data.name;
  state.opponentName= data.opponent;
  state.role        = 'player';
  state.waitingForOpponent = false;
  cancelMatchmakingUI();
  switchScreen('game');
  UI.setRoomId(data.room);
  UI.setPlayerName(data.mark, data.name);
  UI.setPlayerName(data.mark === 'X' ? 'O' : 'X', data.opponent);
  UI.hideWaiting();
  drawBoard();
  toast('Opponent found! Game starting…');
});

// ── Matchmaking status ────────────────────────────────────────────────────────
socket.on('matchmaking', (data) => {
  if (data.status === 'searching') {
    document.getElementById('matchStatus').textContent = data.message || 'Searching…';
    document.getElementById('matchStatus').classList.remove('hidden');
    document.getElementById('btnCancelMatch').classList.remove('hidden');
    document.getElementById('btnQuick').classList.add('hidden');
  } else {
    cancelMatchmakingUI();
  }
});

// ── Opponent joined (P1 notified) ─────────────────────────────────────────────
socket.on('opponentJoined', (data) => {
  state.opponentName = data.name;
  state.waitingForOpponent = false;
  UI.setPlayerName(data.mark, data.name);
  UI.hideWaiting();
  drawBoard();
  toast(`${data.name} joined the room!`);
});

// ── Spectating ────────────────────────────────────────────────────────────────
socket.on('spectating', (data) => {
  state.room        = data.room;
  state.role        = 'spectator';
  state.board       = data.board;
  state.currentMark = data.currentMark;
  switchScreen('game');
  UI.setRoomId(data.room);
  data.players.forEach(p => UI.setPlayerName(p.mark, p.name + ' (playing)'));
  UI.hideWaiting();
  data.chat.forEach(msg => UI.appendChat(msg));
  drawBoard();
  UI.setStatus('👁 Spectating');
});

// ── Move made (server authoritative) ──────────────────────────────────────────
// FIX: Both X and O always render via this event — including the local player's move.
socket.on('moveMade', (data) => {
  state.board[data.row][data.col] = data.mark;
  drawBoard(); // render FIRST, then any result follows
});

// ── Turn update ───────────────────────────────────────────────────────────────
socket.on('turnUpdate', (data) => {
  state.currentMark = data.currentMark;
  state.myTurn = (state.mark === data.currentMark) && !state.gameEnded && state.role === 'player';
  updateTurnUI();
});

// ── Win line ──────────────────────────────────────────────────────────────────
socket.on('winLine', (data) => {
  winLine = data.line;
  drawBoard(); // show highlight before result modal
});

// ── Game result ───────────────────────────────────────────────────────────────
// Server sends this ~300ms AFTER moveMade+winLine, so the board is already rendered.
socket.on('gameResult', (data) => {
  state.gameEnded = true;
  state.myTurn    = false;
  updateTurnUI();

  const emojiMap = { win: '🎉', lose: '😔', tie: '🤝', spectate: '🏁' };
  const emoji = emojiMap[data.result] || '🏁';
  UI.showResultModal(emoji, data.message, data.result);
});

// ── Reconnect token ────────────────────────────────────────────────────────────
socket.on('reconnectToken', (data) => {
  sessionStorage.setItem('reconnectToken', data.token);
  state.reconnectToken = data.token;
});

// ── Reconnected ───────────────────────────────────────────────────────────────
socket.on('reconnected', (data) => {
  state.room        = data.room;
  state.mark        = data.mark;
  state.myName      = data.name;
  state.board       = data.board;
  state.currentMark = data.currentMark;
  state.role        = 'player';
  state.gameEnded   = false;
  state.myTurn      = (state.mark === state.currentMark);
  sessionStorage.removeItem('reconnectToken');
  UI.setRoomId(data.room);
  UI.hideReconnectOverlay();
  UI.hideWaiting();
  data.chat.forEach(m => UI.appendChat(m));
  drawBoard();
  updateTurnUI();
  toast('Reconnected successfully!');
});

// ── Opponent disconnected ─────────────────────────────────────────────────────
socket.on('opponentDisconnected', (data) => {
  UI.showReconnectOverlay(
    `${data.name} disconnected…`,
    data.timeoutSeconds
  );
  state.myTurn = false;
  updateTurnUI();
});

socket.on('opponentReconnected', (data) => {
  UI.hideReconnectOverlay();
  toast(`${data.name} reconnected!`);
  state.myTurn = (state.mark === state.currentMark) && !state.gameEnded;
  updateTurnUI();
});

// ── Opponent left ─────────────────────────────────────────────────────────────
socket.on('opponentLeft', (data) => {
  UI.hideReconnectOverlay();
  toast(`${data.name} left the room.`);
  state.gameEnded = true;
  state.myTurn = false;
  updateTurnUI();
  UI.showResultModal('🚪', `${data.name} left the room.`, 'opponentLeft');
});

// ── Rematch ───────────────────────────────────────────────────────────────────
socket.on('rematchPending', (data) => {
  UI.setStatus(data.message);
});
socket.on('rematchRequested', (data) => {
  toast(`${data.from} wants a rematch! Click Rematch to accept.`);
});
socket.on('rematchStart', (data) => {
  state.board       = data.board;
  state.currentMark = data.currentMark;
  state.gameEnded   = false;
  winLine           = null;

  // Update marks
  data.players.forEach(p => {
    if (p.socketId === socket.id) state.mark = p.mark;
    else state.opponentName = p.name;
    UI.setPlayerName(p.mark, p.name);
  });

  state.myTurn = (state.mark === state.currentMark) && state.role === 'player';
  UI.hideResultModal();
  drawBoard();
  updateTurnUI();
  toast('Rematch started! Marks swapped.');
});

// ── Chat ──────────────────────────────────────────────────────────────────────
socket.on('chatMessage', (msg) => {
  UI.appendChat(msg);
});

// ── Errors ────────────────────────────────────────────────────────────────────
socket.on('err', (data) => {
  console.error('[DEBUG] Socket error:', data.message);
  toast(data.message || 'An error occurred', true);
  // If it was a join/create error, restore myTurn if we had it
  if (state.mark && state.currentMark === state.mark && !state.gameEnded) {
    state.myTurn = true;
    updateTurnUI();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const UI = {
  setRoomId(id) {
    document.getElementById('roomDisplay').textContent = id;
    document.getElementById('waitingRoomId').textContent = id;
  },
  setPlayerName(mark, name) {
    document.getElementById(mark === 'X' ? 'p1Name' : 'p2Name').textContent = name;
  },
  setStatus(msg) {
    document.getElementById('statusBar').textContent = msg;
  },
  showWaiting(roomId) {
    document.getElementById('waitingOverlay').classList.remove('hidden');
    document.getElementById('waitingRoomId').textContent = roomId;
  },
  hideWaiting() {
    document.getElementById('waitingOverlay').classList.add('hidden');
  },
  showResultModal(emoji, title, result) {
    document.getElementById('resultEmoji').textContent = emoji;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultMessage').textContent = '';

    // Show/hide rematch based on result
    const showRematch = ['win','lose','tie'].includes(result);
    document.getElementById('btnRematch').style.display = showRematch ? '' : 'none';

    document.getElementById('resultBackdrop').classList.remove('hidden');
  },
  hideResultModal() {
    document.getElementById('resultBackdrop').classList.add('hidden');
  },
  showReconnectOverlay(msg, seconds) {
    document.getElementById('reconnectMsg').textContent = msg;
    document.getElementById('reconnectOverlay').classList.remove('hidden');

    if (seconds) {
      let remaining = seconds;
      document.getElementById('reconnectCountdown').textContent = `${remaining}s remaining`;
      const interval = setInterval(() => {
        remaining--;
        document.getElementById('reconnectCountdown').textContent = `${remaining}s remaining`;
        if (remaining <= 0) clearInterval(interval);
      }, 1000);
    }
  },
  hideReconnectOverlay() {
    document.getElementById('reconnectOverlay').classList.add('hidden');
    document.getElementById('reconnectCountdown').textContent = '';
  },
  appendChat(msg) {
    const box = document.getElementById('chatMessages');
    const el = document.createElement('div');
    el.className = msg.system ? 'chat-msg system' : 'chat-msg';

    if (msg.system) {
      el.textContent = msg.text;
    } else {
      const ts = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      el.innerHTML =
        `<span class="msg-from">${escapeHtml(msg.from)}</span>` +
        escapeHtml(msg.text) +
        `<span class="msg-ts">${ts}</span>`;
    }

    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function updateTurnUI() {
  const xCard  = document.getElementById('cardP1');
  const oCard  = document.getElementById('cardP2');
  const turnX  = document.getElementById('turnX');
  const turnO  = document.getElementById('turnO');
  const status = document.getElementById('statusBar');

  xCard.classList.toggle('active', state.currentMark === 'X');
  oCard.classList.toggle('active', state.currentMark === 'O');
  turnX.textContent = state.currentMark === 'X' ? '▶' : '';
  turnO.textContent = state.currentMark === 'O' ? '▶' : '';

  if (state.gameEnded) {
    status.textContent = 'Game over';
  } else if (state.role === 'spectator') {
    status.textContent = `${state.currentMark}'s turn`;
  } else if (state.myTurn) {
    status.textContent = '✨ Your turn';
  } else {
    status.textContent = "Opponent's turn…";
  }

  canvas.style.cursor = (state.myTurn && !state.gameEnded) ? 'crosshair' : 'not-allowed';
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN SWITCHING
// ══════════════════════════════════════════════════════════════════════════════
function switchScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  state.screen = name;

  if (name === 'game') {
    resizeCanvas();
    // Reset board state visually
    winLine   = null;
    state.gameEnded = false;
  }
}

function returnToLobby() {
  // Reset state
  Object.assign(state, {
    screen: 'lobby', role: null, mark: null, room: null,
    myName: null, opponentName: null,
    board: createEmptyBoard(),
    currentMark: 'X', myTurn: false, gameEnded: false,
    waitingForOpponent: true,
  });
  winLine = null;
  sessionStorage.removeItem('reconnectToken');
  UI.hideResultModal();
  switchScreen('lobby');
}

// ══════════════════════════════════════════════════════════════════════════════
// LOBBY BUTTONS
// ══════════════════════════════════════════════════════════════════════════════
document.getElementById('btnCreate').addEventListener('click', () => {
  const name = document.getElementById('nameNew').value.trim();
  console.log('[DEBUG] btnCreate clicked, name:', name);
  if (!name) return toast('Please enter your name', true);
  console.log('[DEBUG] Emitting createGame event with name:', name);
  socket.emit('createGame', { name });
});

document.getElementById('btnJoin').addEventListener('click', () => {
  const name = document.getElementById('nameJoin').value.trim();
  const room = document.getElementById('roomInput').value.trim();
  console.log('[DEBUG] btnJoin clicked, name:', name, 'room:', room);
  if (!name || !room) return toast('Please enter name and room ID', true);
  console.log('[DEBUG] Emitting joinGame event');
  socket.emit('joinGame', { name, room });
});

document.getElementById('btnQuick').addEventListener('click', () => {
  const name = document.getElementById('nameQuick').value.trim();
  console.log('[DEBUG] btnQuick clicked, name:', name);
  if (!name) return toast('Please enter your name', true);
  console.log('[DEBUG] Emitting quickMatch event');
  socket.emit('quickMatch', { name });
});

document.getElementById('btnCancelMatch').addEventListener('click', () => {
  socket.emit('cancelMatchmaking');
  cancelMatchmakingUI();
});

document.getElementById('btnSpectate').addEventListener('click', () => {
  const room = document.getElementById('roomSpectate').value.trim();
  if (!room) return toast('Please enter room ID', true);
  socket.emit('spectateGame', { room });
});

// ── Game controls ─────────────────────────────────────────────────────────────
document.getElementById('btnLeave').addEventListener('click', () => {
  if (state.room) socket.emit('leaveRoom', { room: state.room });
  returnToLobby();
});

document.getElementById('btnRematch').addEventListener('click', () => {
  if (state.room) socket.emit('requestRematch', { room: state.room });
  UI.setStatus('Rematch requested…');
});

document.getElementById('btnExitRoom').addEventListener('click', () => {
  if (state.room) socket.emit('leaveRoom', { room: state.room });
  returnToLobby();
});

// Copy room ID
document.getElementById('btnCopyRoom').addEventListener('click', () => {
  if (state.room) {
    navigator.clipboard.writeText(state.room).then(() => toast('Room ID copied!'));
  }
});

// ── Chat ──────────────────────────────────────────────────────────────────────
document.getElementById('btnSendChat').addEventListener('click', sendChat);
document.getElementById('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !state.room) return;
  socket.emit('sendChat', { room: state.room, text });
  input.value = '';
}

// ── Theme toggle ──────────────────────────────────────────────────────────────
const themeBtn = document.getElementById('themeToggle');
themeBtn.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeBtn.textContent = next === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('theme', next);
  drawBoard();
});
// Restore saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════════
let toastTimer;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  el.style.borderColor = isError ? 'var(--danger)' : 'var(--border)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hidden');
  }, 3000);
}

// ══════════════════════════════════════════════════════════════════════════════
// MISC
// ══════════════════════════════════════════════════════════════════════════════
function cancelMatchmakingUI() {
  document.getElementById('matchStatus').classList.add('hidden');
  document.getElementById('btnCancelMatch').classList.add('hidden');
  document.getElementById('btnQuick').classList.remove('hidden');
}

window.addEventListener('resize', () => {
  if (state.screen === 'game') resizeCanvas();
});

// Allow Enter key on lobby inputs
['nameNew','nameJoin','roomInput','nameQuick','roomSpectate'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (id === 'nameNew')     document.getElementById('btnCreate').click();
      if (id === 'nameJoin' || id === 'roomInput') document.getElementById('btnJoin').click();
      if (id === 'nameQuick')   document.getElementById('btnQuick').click();
      if (id === 'roomSpectate')document.getElementById('btnSpectate').click();
    }
  });
});
