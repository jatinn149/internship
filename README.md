# Virtual Cosmos

2D real-time multiplayer virtual space where users move in a shared world and can chat only when they are close enough.


## Objective
Build a virtual office style cosmos that demonstrates:
- Real-time multiplayer movement
- Proximity-based connect/disconnect logic
- Chat availability only when users are connected by proximity

## Tech Stack (Recommended Stack Used)
### Frontend
- React (Vite)
- TypeScript
- PixiJS
- Tailwind CSS
- Socket.IO Client

### Backend
- Node.js (Express)
- TypeScript
- Socket.IO
- MongoDB (Mongoose)

## Must-Have Requirements Coverage
1. User movement in 2D space:
- Implemented with keyboard controls (WASD and arrow keys) in a PixiJS world.

2. Real-time multiplayer:
- Multiple users are visible simultaneously with live position sync.

3. Proximity detection:
- Users auto-connect when close and auto-disconnect when far.

4. Chat system:
- Chat is enabled only for users connected by proximity.

5. UI/UX:
- Clean map-based interface for movement and interaction.

## Backend Requirements Coverage
Backend tracks:
- userId
- position (x, y)
- active proximity connections

Socket events handle:
- position updates
- connection/disconnection lifecycle
- chat messaging

## User Flow
1. User joins cosmos.
2. User sees other users moving in real time.
3. User moves close to another user and chat becomes available.
4. User moves away and connection/chat is removed.

## Additional Features (Bonus)
- Room-based world: Social Lounge, Innovation Hub, Game Arena, Zen Garden
- Social Lounge voice controls and speaking indicator
- Innovation Hub presenter lock, whiteboard, idea voting
- Game Arena mini-games: Tap Race and Dice Clash
- Game Arena player-to-player matchmaking (challenge, accept/reject)
- Multiple Game Arena matches can run simultaneously
- Match-isolated game state (only participants see their match panel)
- MongoDB session position persistence
- Map zoom controls

## Game Arena Match Flow (Final)
1. User enters Game Arena.
2. User selects game type and challenges a specific player.
3. Target player accepts or rejects challenge.
4. On accept, a dedicated match starts for that pair.
5. Other users in Game Arena remain in lobby and can start separate matches.

## Setup
### Prerequisites
- Node.js 18+
- npm 9+
- MongoDB running locally (or Docker)

### Install dependencies
```bash
cd backend
npm install

cd ../frontend
npm install
```

### Configure backend environment
```bash
cd ../backend
copy .env.example .env
```

Default .env values:
```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/virtual-cosmos
FRONTEND_URL=http://localhost:5173
```

## Run (Development)
### Terminal 1 (backend)
```bash
cd backend
npm run dev
```

### Terminal 2 (frontend)
```bash
cd frontend
npm run dev
```

URLs:
- Frontend: http://localhost:5173
- Backend: http://localhost:4000
