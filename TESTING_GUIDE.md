# Testing Guide

## Quick Start Testing

### 1. Start the Server
```bash
npm start
```
Server will run on `http://localhost:3000`

### 2. Test Option A: Via Live Server (VS Code Extension)
1. Right-click on `public/index.html`
2. Select "Open with Live Server"
3. Opens on `http://localhost:5500`
4. Socket.IO will connect to `http://localhost:3000`

### 3. Test Option B: Direct URL
Open browser and go to: `http://localhost:3000`

## Test Scenarios

### Scenario 1: Create a Game
1. Enter a name (e.g., "Player1")
2. Click "🎮 Create Game"
3. **Expected:** 
   - Room ID appears (e.g., "room-abc123")
   - Copy button appears
   - "Waiting for opponent..." message displays
   - Browser console shows: `[DEBUG] gameCreated event received`

### Scenario 2: Join an Existing Game (2 Browsers/Tabs)
1. **Browser 1:** Create a game, copy the room ID
2. **Browser 2:** 
   - Enter a name (e.g., "Player2")
   - Paste the room ID
   - Click "🚪 Join Game"
3. **Expected:**
   - Both browsers show the 15×15 Caro board
   - Player1 (X) sees "Your turn"
   - Player2 (O) sees "Waiting for opponent..."
   - Console shows: `[DEBUG] gameJoined event received`

### Scenario 3: Play Moves
1. Player 1 clicks on any cell on the board
2. **Expected:**
   - Cell fills with X
   - Board updates for both players
   - Turn passes to Player 2
3. Player 2 clicks a cell
   - Cell fills with O
   - Turn passes back to Player 1

### Scenario 4: Win Condition
1. One player gets 5 in a row (horizontal, vertical, or diagonal)
2. **Expected:**
   - Winning line highlights
   - Result modal appears: "You Win!" or "You Lose!"
   - "Rematch" and "Exit Room" buttons appear

## Console Debugging

Open browser DevTools (F12) and check Console for logs:

### Socket Connection Logs
```
[DEBUG] app.js loaded
[DEBUG] Attempting to initialize socket.io...
[DEBUG] Socket.io object created: Socket ...
[DEBUG] Socket connected: xxxxx
```

### Button Click Logs
```
[DEBUG] btnCreate clicked, name: Player1
[DEBUG] Emitting createGame event with name: Player1
```

### Server-Side Logs
```
[createGame] Socket xxxxx creating game, name: Player1
[createGame] Room created: room-abc123 for player: Player1
[joinGame] Socket xxxxx joining game, name: Player2, room: room-abc123
[joinGame] Player Player2 joined room room-abc123
```

## Common Issues & Fixes

### Issue: "Socket not connected"
**Solution:** Check if server is running on port 3000
```bash
npm start
```

### Issue: "Connection refused" on port 5500
**Solution:** Open with Live Server again or use direct URL

### Issue: Blank screen
**Solution:** 
- Hard refresh (Ctrl+Shift+R)
- Check F12 console for errors
- Ensure `public/index.html` and `public/js/app.js` exist

### Issue: Buttons don't respond
**Solution:** Check console for logs
- Should see `[DEBUG] btnCreate clicked` when clicked
- If not, app.js didn't load properly

### Issue: Can't join room
**Solution:** 
- Check room ID is correct
- Room must still have < 2 players
- Check server console for join errors

## Quick Diagnostic Checklist

- [ ] Server running: `npm start`
- [ ] Can access `http://localhost:3000` or `http://localhost:5500`
- [ ] F12 console shows `[DEBUG] Socket connected`
- [ ] Can enter name and click buttons
- [ ] Console shows button click logs
- [ ] Create Game works (room ID appears)
- [ ] Join Game works (board displays)
- [ ] Can click board cells
- [ ] Opponent sees moves in real-time
- [ ] Win detection works

## Performance Notes

- **Board Size:** 15×15 = 225 cells
- **Canvas Rendering:** Updated on each move
- **Socket Events:** ~30 events/second rate limit per socket
- **Rooms:** Unlimited (in-memory storage)
- **Max Players/Room:** 2 players + unlimited spectators
