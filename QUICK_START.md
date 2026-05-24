# Quick Reference: Project Setup & Commands

## Folder Structure (Final)

```
c:\laragon\www\new_caro\
├── src/
│   ├── config/
│   │   └── server.config.js              # Server configuration
│   ├── constants/
│   │   └── game.constants.js             # Game constants (15, 5-in-a-row, etc.)
│   ├── game/
│   │   ├── GameLogic.js                  # Pure game logic (no dependencies)
│   │   └── RoomManager.js                # Room & session management
│   ├── handlers/
│   │   ├── chatHandler.js                # Chat socket events
│   │   ├── gameHandler.js                # Game socket events (with debug logs)
│   │   └── matchmakingHandler.js         # Quick match queue
│   ├── models/                           # (empty, for future)
│   ├── utils/                            # (empty, for future utilities)
│   └── server.js                         # 🚀 Entry point (Express + Socket.IO)
├── public/
│   ├── css/
│   │   └── style.css                     # Modern CSS with dark/light theme
│   ├── js/
│   │   └── app.js                        # 🎮 Client app (Vanilla JS, Canvas, debug logs)
│   └── index.html                        # 🌐 Single-page app (Socket.IO v4.7.2 CDN)
├── .env                                  # 🔐 Environment variables (PORT=3000)
├── .env.example                          # Template
├── .gitignore                            # Git ignore rules
├── package.json                          # npm dependencies
├── package-lock.json                     # Lock file
├── README.md                             # Quick start guide
├── MIGRATION_ANALYSIS.md                 # Old vs New comparison
├── TESTING_GUIDE.md                      # Complete testing guide
├── MIGRATION_COMPLETE_REPORT.md          # Full migration report
└── node_modules/                         # Installed packages

TOTAL: 7 directories, 20+ files
```

## Quick Start Commands

### 1️⃣ Installation (One-time)
```bash
cd c:\laragon\www\new_caro
npm install
```

### 2️⃣ Start Server
```bash
npm start
```

Output should show:
```
╔════════════════════════════════════════════════════════════╗
║        🎮 Caro Online - Gomoku 15×15 Server              ║
╚════════════════════════════════════════════════════════════╝
[INFO] Server running on port 3000
[INFO] Socket.IO v4 configured with cors for: ...
[INFO] Ready to accept connections...
```

### 3️⃣ Start Development (Auto-reload)
```bash
npm run dev
```

### 4️⃣ Access Application

**Option A - Direct URL:**
```
http://localhost:3000
```

**Option B - VS Code Live Server:**
1. Right-click `public/index.html`
2. Select "Open with Live Server"
3. Browser opens `http://localhost:5500`
4. Socket.IO connects to `http://localhost:3000` automatically

## File Descriptions

### Entry Point
- **src/server.js** - Main Express + Socket.IO server, sets up all routes and handlers

### Game Logic
- **src/game/GameLogic.js** - Pure game logic (no side effects)
  - `createBoard()` - Creates 15×15 empty board
  - `validateMove()` - Validates move coordinates
  - `applyMove()` - Updates board state
  - `checkWinner()` - Detects 5-in-a-row
  - `isBoardFull()` - Detects draw

- **src/game/RoomManager.js** - Manages rooms and sessions
  - In-memory storage of active rooms
  - Player connection tracking
  - Reconnection token system
  - Spectator management

### Socket Handlers
- **src/handlers/gameHandler.js** - Game events
  - `createGame` - Create new room
  - `joinGame` - Join existing room
  - `playTurn` - Make move
  - `requestRematch` - Start new game
  - `leaveRoom` - Quit game

- **src/handlers/chatHandler.js** - Chat events
  - `sendMessage` - Send chat message

- **src/handlers/matchmakingHandler.js** - Matchmaking
  - `quickMatch` - Join matchmaking queue
  - `cancelMatchmaking` - Leave queue

### Frontend
- **public/js/app.js** - Complete client application
  - **State** - Single source of truth for game state
  - **Canvas Board** - HTML5 canvas rendering
  - **Socket Events** - All Socket.IO event handlers
  - **UI Helpers** - DOM manipulation
  - **Lobby Buttons** - Event listeners

- **public/index.html** - Single-page app HTML
  - Lobby screen (Create/Join/Quick Match)
  - Game screen (Board + Sidebars)
  - Result modal (Win/Lose/Draw)
  - Socket.IO library loaded from CDN

- **public/css/style.css** - Responsive styling
  - Dark and light themes
  - Mobile-first design
  - Canvas styling

## Debug Logging

### Enable/Check Logs
Open browser DevTools: **F12** → **Console**

### Frontend Logs (Browser Console)
```javascript
[DEBUG] app.js loaded
[DEBUG] Socket connected: <socket-id>
[DEBUG] btnCreate clicked, name: <name>
[DEBUG] gameCreated event received: <data>
```

### Server Logs (Terminal)
```
[connect] <socket-id>
[createGame] Socket <id> creating game, name: <name>
[joinGame] Player <name> joined room <room-id>
[disconnect] <socket-id> — <reason>
```

## Testing Checklist

- [ ] Start server: `npm start`
- [ ] Open `http://localhost:3000` or `http://localhost:5500`
- [ ] F12 console shows `[DEBUG] Socket connected`
- [ ] Enter name and create game
- [ ] Copy room ID
- [ ] Open second browser/tab
- [ ] Enter different name and join game
- [ ] Both see game board
- [ ] Click cells to make moves
- [ ] Moves appear in real-time
- [ ] Win condition works
- [ ] No console errors

## Dependencies

**Runtime** (in package.json):
- `express@^4.18.2` - Web server
- `socket.io@^4.7.2` - Real-time communication
- `helmet@^7.1.0` - Security headers
- `cors@^2.8.5` - Cross-origin support
- `dotenv@^16.3.1` - Environment variables
- `uuid@^9.0.0` - Room ID generation
- `sanitize-html@^2.11.0` - HTML sanitization

**Development**:
- `nodemon@^3.0.2` - Auto-restart on file changes

## Key Features

✅ **Caro/Gomoku Game**
- 15×15 board (225 cells)
- 5-in-a-row win condition (any direction)
- Server-side validation

✅ **Real-time Multiplayer**
- Socket.IO v4 communication
- Instant board updates
- Turn-based gameplay

✅ **Room System**
- UUID-based room IDs
- Max 2 players per room
- Spectator support

✅ **UI/UX**
- Canvas-based rendering
- Dark/light theme toggle
- Responsive design
- Real-time chat

✅ **Reliability**
- Reconnection support (30-second window)
- Rate limiting (30 events/sec per socket)
- Error handling and validation
- CORS configured for local testing

## Troubleshooting

### Port Already in Use
```bash
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /F /PID <PID>

# Or just change PORT in .env
PORT=4000
```

### Socket Connection Failed
1. Check server is running: `npm start`
2. Check browser console (F12) for errors
3. Hard refresh: **Ctrl+Shift+R**
4. Check CORS origins in server.js

### Can't See Board After Join
1. Check both players see the same room ID
2. Check server console for errors
3. Refresh page and try again

### Moves Not Syncing
1. Check network tab (F12) for socket events
2. Check browser console for JavaScript errors
3. Check server console for handler errors

## File Sizes (approx)

```
src/
  server.js               ~5 KB
  game/GameLogic.js       ~4 KB
  game/RoomManager.js     ~6 KB
  handlers/gameHandler.js ~8 KB
  handlers/*.js           ~2 KB each
public/
  js/app.js               ~20 KB (Vanilla JS, no dependencies)
  css/style.css           ~8 KB
  index.html              ~5 KB
```

Total minified: ~70-80 KB (excluding node_modules)

## Next Steps

1. ✅ **Test locally** - Run both create and join scenarios
2. ✅ **Verify logs** - Check console for debug messages
3. ✅ **Test multiplayer** - Use 2 browsers/tabs
4. ✅ **Verify win condition** - Get 5 in a row
5. ✅ **Check responsiveness** - Resize window to test mobile
6. 📤 **Deploy** - Push to GitHub or cloud platform
7. 📊 **Monitor** - Use console logs for debugging

## Performance Optimization

Already implemented:
- ✓ Canvas rendering (efficient)
- ✓ Socket.IO v4 (optimized)
- ✓ Rate limiting (30 events/sec)
- ✓ Debouncing (200ms move cooldown)
- ✓ Efficient room storage (UUID-based)

## Security Features

- ✓ Helmet security headers
- ✓ CORS configured for specific origins
- ✓ HTML sanitization (sanitize-html)
- ✓ Input validation on server
- ✓ Rate limiting on HTTP and Socket events

---

**Ready to play Caro Online! 🎮**

For detailed migration info, see: `MIGRATION_COMPLETE_REPORT.md`
For testing info, see: `TESTING_GUIDE.md`
