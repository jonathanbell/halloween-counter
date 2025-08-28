# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev         # Start Vite dev server at http://localhost:5173 (development only)
npm run dev:server  # Start SSE server at http://localhost:3000
npm run dev:all     # Build React app and start SSE server
npm run build       # TypeScript check + Vite production build
npm run preview     # Preview production build locally
npm run lint        # Run ESLint checks
npm run server      # Start SSE server (requires built dist/ folder)
npm run start       # Production: build and start server
```

## Architecture Overview

This is a Halloween trick-or-treater counter app designed for projection onto a garage door with remote control capabilities via Server-Sent Events (SSE). It uses a Vite/React/TypeScript stack with Rive animations for zombie characters and a lightweight Node.js server for real-time synchronization across devices.

### Server-Sent Events (SSE) Architecture

The app uses a lightweight Node.js server for real-time state synchronization:

1. **Server** (`server.js`): Lightweight HTTP server using Node.js built-ins
   - No external dependencies (no Express needed)
   - SSE endpoint at `/events` for real-time updates
   - REST endpoints: `/increment`, `/settings`, `/state`
   - Serves static files for React app and control pages
   - Maintains counter state in memory
   - Broadcasts updates to all connected clients

2. **SSE Connection** (`src/hooks/useSSE.ts`): Handles real-time connection
   - Automatic reconnection with exponential backoff
   - Connection status monitoring
   - Parses and distributes server state updates

3. **Remote Control** (`public/remote.html`): Mobile-friendly interface
   - Large touch targets for easy mobile use
   - Real-time counter display via SSE
   - Connection status indicator
   - Optimistic updates with server sync

4. **Settings Page** (`public/settings.html`): Configuration interface
   - Update current count and initial candy count
   - Server-side state persistence

### Key State Management Pattern

The app uses server-based state management with optimistic updates:

1. **useCounter** (`src/hooks/useCounter.ts`): Server-synchronized counter
   - Receives real-time updates via SSE
   - Sends increment requests to server
   - Optimistic updates for instant feedback
   - Redirects to settings page for reset

2. **useStats** (`src/hooks/useStats.ts`): Calculates real-time statistics
   - Uses `useMemo` for expensive calculations to prevent unnecessary re-renders
   - Tracks timestamps of each visitor for average time calculations
   - Updates every 5 seconds via forced re-render pattern

### Component Performance Optimizations

All display components use `React.memo` to prevent unnecessary re-renders:

- Counter, CandyProgress, StatsDisplay components are memoized
- ZombieWalker uses custom comparison function for position-based updates
- Zombie virtualization only renders visible zombies (position -10 to 110)

### Keyboard Event Architecture

All keyboard handlers are centralized in `App.tsx`:

- Space: Increment counter
- Ctrl+R: Reset counter (with confirmation)
- Ctrl+F: Toggle fullscreen

### Animation System

- **Counter animations**: CSS keyframes for digit flip effects
- **Zombie animations**: Rive-based with multiple instances
  - Each zombie has random speed, scale, and y-offset
  - Continuous animation loop using requestAnimationFrame
  - Zombies reset position when reaching candy target
  - "Hit" animation triggers when candy runs out

### Critical Performance Considerations

1. **Zombie Virtualization**: Only visible zombies render to maintain 60fps
2. **Memoized Calculations**: Stats calculations use useMemo to avoid recalculation
3. **Timeout Cleanup**: All setTimeout calls have cleanup functions to prevent memory leaks
4. **Animation Frame Management**: Single RAF loop manages all zombie positions

## Testing Locally

Start the SSE server for testing:

```bash
npm run start  # Build and start server
```

Access the different interfaces:

- Main counter display: `http://localhost:3000`
- Remote control: `http://localhost:3000/remote`
- Settings page: `http://localhost:3000/settings`

For network testing from other devices:

- Find your local IP address (`ifconfig` or `ipconfig`)
- Access via `http://<your-ip>:3000/remote` on mobile devices

## Production Deployment

The app is designed to run locally on Halloween night with network control:

1. Build and start: `npm run start`
2. Server binds to `0.0.0.0:3000` for network access
3. Main display on projector: `http://localhost:3000`
4. Remote controls on phones: `http://<your-ip>:3000/remote`
5. Press Ctrl+F for fullscreen projection mode

### Network Setup

- Server automatically allows local network connections
- All devices must be on the same network
- Real-time synchronization via SSE
- No internet connection required
