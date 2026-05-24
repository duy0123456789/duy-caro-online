# ♟ Caro Online – Multiplayer Gomoku 15×15

Production-ready real-time multiplayer Caro (Gomoku) platform built with Node.js, Express, Socket.IO v4.

## Features

- **15×15 canvas board** with 5-in-a-row win condition
- **Win rendering fix** — final move renders on board for BOTH players before any popup
- **Consistent end-game UI** — Win/Lose/Draw modal with Rematch + Exit buttons for both players
- **Rematch system** — both players must accept; marks swap for fairness
- **Reconnect support** — 30-second window to rejoin after disconnect
- **Quick Match** — matchmaking queue
- **Spectator mode** — watch any room live, participate in chat
- **Real-time chat** — timestamps, system messages, per-room
- **Dark / Light theme** toggle
- **Server-side validation** — turn order, empty cell, player identity, rate limiting
- **Socket.IO v4** — modern adapter API throughout
- **Mobile responsive** — touch support, adaptive canvas scaling

## Project Structure

```
src/
  server.js                  ← Entry point (Express + Socket.IO)
  game/
    GameLogic.js             ← Pure game logic (board, win detection)
    RoomManager.js           ← In-memory room/session/matchmaking state
  handlers/
    gameHandler.js           ← Game socket events (create, join, play, rematch…)
    chatHandler.js           ← Chat events
    matchmakingHandler.js    ← Quick match queue

public/
  index.html                 ← Single-page UI
  css/style.css              ← Dark/light theme, responsive layout
  js/app.js                  ← Client: canvas board, socket events, UI
```

## Quick Start

```bash
npm install
cp .env.example .env
npm start          # production
npm run dev        # with nodemon
```

Open `http://localhost:3000`

## Key Bug Fixes vs Original

| Issue | Fix |
|---|---|
| X's final move not shown before win popup | Server sends `moveMade` → `winLine` → `gameResult` (300ms gap). Client renders board before modal. |
| Losing player inconsistent UI | Both players receive `gameResult` with their own result string |
| `socket.leave()` on client | Removed. Only server can call `socket.leave()` |
| Socket.IO v1 `adapter.rooms[id]` | Updated to `io.sockets.adapter.rooms.get(id)` (v4 Map API) |
| No server validation | Added: turn order, cell occupancy, player identity, rate limiting |
| 3×3 Tic-Tac-Toe | Upgraded to real 15×15 Caro canvas board |

## Socket Events Reference

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `createGame` | `{name}` | Create new room |
| `joinGame` | `{name, room}` | Join existing room |
| `quickMatch` | `{name}` | Enter matchmaking queue |
| `cancelMatchmaking` | — | Leave queue |
| `spectateGame` | `{room}` | Watch a room |
| `playTurn` | `{room, row, col}` | Place a piece |
| `requestRematch` | `{room}` | Request rematch |
| `leaveRoom` | `{room}` | Leave voluntarily |
| `reconnectGame` | `{token}` | Reconnect with token |
| `sendChat` | `{room, text}` | Send chat message |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `gameCreated` | `{room, name, mark}` | Room created (P1) |
| `gameJoined` | `{room, name, mark, board}` | Joined room (P2) |
| `opponentJoined` | `{name, mark}` | P2 arrived (P1 notification) |
| `matchFound` | `{room, name, mark, opponent}` | Quick match found |
| `moveMade` | `{row, col, mark}` | Authoritative move (both players) |
| `turnUpdate` | `{currentMark}` | Whose turn it is |
| `winLine` | `{line}` | Winning cells to highlight |
| `gameResult` | `{result, message, winner, line}` | Win/lose/tie (per player) |
| `rematchStart` | `{board, currentMark, players}` | Rematch begun |
| `reconnectToken` | `{token}` | Reconnect token on disconnect |
| `reconnected` | `{room, mark, name, board, …}` | Reconnect success |
| `opponentDisconnected` | `{name, timeoutSeconds}` | Opponent left temporarily |
| `opponentLeft` | `{name}` | Opponent left permanently |
| `chatMessage` | `{from, text, ts, system}` | Chat message |
| `err` | `{message}` | Error message |

## Deployment

Works on any Node.js host. For Azure/Render/Railway, set the `PORT` env var.

### Render / Railway
```
Build: npm install
Start: node src/server.js
```

### Azure App Service
Set `SCM_DO_BUILD_DURING_DEPLOYMENT=true` and start command `node src/server.js`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `RECONNECT_TIMEOUT` | `30` | Seconds to wait for reconnect |
| `MONGODB_URI` | — | Optional MongoDB (for future profiles/rankings) |
