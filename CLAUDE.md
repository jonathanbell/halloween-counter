# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status: Migration to Spring Boot

This repository is transitioning from a Node.js-based counter (`server.js`) to a Spring Boot backend. The new Spring Boot app is under active development and provides:

- REST + SSE performance (counter, events, effects)
- WebSocket-based game (Whack-a-zombie)
- Flyway-driven schema migrations against remote managed Postgres
- Admin token–protected API endpoints

Legacy Node server (`server.js`) still exists; the frontend is a Vite/React/TypeScript client. Frontend and Spring Boot should run together during development.

## Development Commands

### Frontend (existing Vite client)

```bash
npm run dev         # Start Vite dev server at http://localhost:5173
npm run build       # TypeScript check + Vite build
npm run preview     # Preview production build locally
npm run lint        # ESLint checks
```

### Backend (new Spring Boot)

```bash
mvn spring-boot:run
mvn clean package -DskipTests
```

### Docker build

```bash
# Build image (requires Java 21 + maven in builder docker container)
docker build -t candy-counter:latest .

# Local docker-network based run (requires Docker Compose)
docker run -p 8080:8080 \
  -e DATABASE_URL="jdbc:postgresql://postgres:5432/candy" \
  -e DATABASE_USER="candy_user" \
  -e DATABASE_PASSWORD="" \
  -e ADMIN_TOKEN="your-admin-token" \
  candy-counter:latest

# Or via docker-compose.yml if exists
# docker-compose up -d
```

### Running in development

Backend on one terminal (`mvn spring-boot:run`) and Vite frontend on another (`npm run dev`). The frontend development server hits Spring Boot through a Vite proxy or CORS configuration.

## Architecture Overview

Root mechanisms:

1. **Spring Boot Backend** (`src/main/java/com/halloween/candy_counter`)
   - CounterService increments candy count
   - SettingsService mutates current year's settings + initial candy
   - SseBroadcaster pushes real-time messages to SSE clients
   - GameService manages game sessions through WebSocket

2. **Game Sessions (WebSocket)**
   - Route: `/ws/game` 
   - Messages: `game_start`, `game_start_denied`, `zombie_spawned`, `zombie_hit`, `game_ended`
   - One concurrent session enforced
   - Zombie spawn events scheduled and broadcast via WebSocket

3. **Data Model** (`events`, `settings`)
   - Every event is persistent + timestamped
   - Settings stored per year in DB
   - Flyway migrations for schema

4. **API Authentication** (`AdminTokenFilter`)
   - Admin endpoint (`/api/counter`, `/api/settings`, `/api/events`) is token-based
   - Tokens provided via `?token=` or `Authorization: Bearer <token>`

5. **Frontend** (vite/React/TS, served via Vite dev)
   - Directory: `src/`
   - Live on `<Projection>`, `<Stats>`, `<Remote>`, `<Settings>`, `<Game>` routes
   - Recharts for time series histogram
   - Homegrown Zombie sprite components

## Critical Performance Considerations

- **Zombie Virtualization**: Only visible zombies render to maintain 60fps
- **Memoized Calculations**: `useMemo` for statistics calculations
- **Timeout Cleanup**: All timers in components carry cleanup functions
- **Animation Frame Management**: Single RAF loop manages all zombie positions

## Testing Locally

Backend (Maven) boots on `http://localhost:8080`. Frontend loads via `npm run dev` on `http://localhost:5173`. Verify tools between requests (e.g., `curl http://localhost:8080/api/settings?year=2026&token=...`).

Steps to test:

1. Start backend: `mvn spring-boot:run`
2. Start frontend: `npm run dev` (or use `npm run preview` after `npm run build`)
3. Hit `http://localhost:8080` or the frontend's proxy

## Production Deployment

The plan is: Spring Boot inside Docker, hosted on a garage machine. Docker image built from `Dockerfile` (Maven + runtime). SMS-Vite React static bundle travels inside the Docker image. For detailed deployment topology see `docs/PRD_2026_HALLOWEEN.md`.

## Notes on Data Safety

- Never commit tokens or passwords to .env.yaml or `application.yml` defaults
- Make sure all increment requests are activated in-browser and decode the token properly
