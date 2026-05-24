# Migration Analysis: OLD vs NEW Architecture

## OLD REPOSITORY STRUCTURE (GitHub)
```
duy-caro-online/
├── index.js              # Server entry (port 5000)
├── main.js               # Client code (jQuery, 3x3 tic-tac-toe)
├── game.html             # Single HTML file
├── main.css              # Basic styles
├── package.json
└── web.config           # Azure deployment
```

## NEW LOCAL STRUCTURE (Refactored - 15x15 Gomoku Caro)
```
new_caro/
├── src/
│   ├── server.js         # Express + Socket.IO v4 server
│   ├── handlers/
│   │   ├── gameHandler.js
│   │   ├── chatHandler.js
│   │   └── matchmakingHandler.js
│   ├── game/
│   │   ├── GameLogic.js   # Pure game logic
│   │   └── RoomManager.js # Room/session management
│   ├── config/
│   ├── constants/
│   ├── utils/
│   └── models/
├── public/
│   ├── index.html        # Single-page app
│   ├── css/style.css     # Modern CSS
│   └── js/app.js         # Vanilla JS client (no jQuery)
├── package.json          # Modern dependencies
└── .env
```

## KEY DIFFERENCES

### ARCHITECTURE CHANGES
| Aspect | OLD | NEW |
|--------|-----|-----|
| **Game Type** | 3×3 Tic-Tac-Toe | 15×15 Caro (Gomoku) |
| **Server Port** | 5000 | 3000 |
| **Socket.IO** | v1.x (adapter.rooms object) | v4.7.2 (modern API) |
| **Frontend** | jQuery + game.html | Vanilla JS + app.js |
| **Game Logic** | Client-side player class | Server-side GameLogic.js |
| **Rooms** | Simple counter (room-0, room-1) | UUID-based (room-xxxxxx) |
| **Board Rendering** | DOM buttons (3×3 grid) | HTML5 Canvas (15×15 grid) |
| **Features** | Basic create/join | Create/join/spectate/quickmatch/rematch |

### SOCKET EVENTS MAPPING
```
OLD → NEW (if applicable)
createGame → createGame (COMPATIBLE)
joinGame → joinGame (COMPATIBLE)  
player1 → opponentJoined (DIFFERENT)
player2 → gameJoined (DIFFERENT)
playTurn → playTurn (DIFFERENT PAYLOAD)
turnPlayed → turnPlayed (DIFFERENT)
gameEnd → gameEnd (DIFFERENT)
err → err (COMPATIBLE)
```

### BREAKING CHANGES
1. **Event payloads changed** - OLD sends tile IDs, NEW sends row/col
2. **Room system** - OLD uses simple counter, NEW uses UUID
3. **Board** - OLD is 3×3 grid, NEW is 15×15 canvas
4. **Win detection** - OLD uses bitmasks for 3×3, NEW uses 5-in-a-row
5. **Player management** - OLD uses client-side classes, NEW uses RoomManager

## OBSOLETE OLD FILES TO REMOVE
- ✗ index.js (replace with new src/server.js)
- ✗ main.js (replace with new public/js/app.js)
- ✗ game.html (replace with new public/index.html)
- ✗ main.css (replace with new public/css/style.css)
- ✗ web.config (Azure-specific, not needed)

## NEW IMPLEMENTATION STRATEGY
1. **Keep** new project architecture as-is (it's well-structured)
2. **Verify** Socket.IO v4 configuration is correct
3. **Add** comprehensive logging for debugging
4. **Test** frontend connection to backend
5. **Document** all socket events

## CRITICAL COMPATIBILITY CHECKS
- [ ] Socket.IO v4 client library in index.html
- [ ] Socket.IO connection URL points to port 3000
- [ ] Express serving public/ as static files
- [ ] All socket event handlers registered
- [ ] No old jQuery dependencies remaining
- [ ] Canvas rendering works without errors
- [ ] Create Game creates room and displays lobby waiting screen
- [ ] Join Game joins room and starts game
- [ ] Board updates work for both players
