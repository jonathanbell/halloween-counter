# Architecture Decision Record (ADR): Halloween 2026

Why we built it this way, and in what sequence it was decided.

## ADR-001: Backend rewrite (Node → Spring Boot)

The original counter was a Vite/React frontend + Node `server.js`. The user requested a full rewrite to Spring Boot in a Docker image. The JVM was chosen for official Postgres driver support, Uniform DI, WebSocket, SSE, and bundled runtime (JAR). This replaced connectivity with a uniform, lightweight API the frontend updates through.

**Decision:** Full re-write to Spring Boot. Frontend kept, backend replaced.

## ADR-002: SSE for counter+projection, WebSocket for game

For the projection side, Server-Sent Events (SSE) are accurate enough (uses EventSource; every subscriber receives same feed). The game client needed bidirectional flow (button taps) and is best served through WebSocket.

**Decision:** SSE broadcasts state; WebSocket handles game.

## ADR-003: Admin token via QR URL param

Viewer QR codes contain the public URL. Admin uses a second QR with a token param on the URL (`?token=...`). Bearer headers are also accepted. This aligns with print-friendly QR admin flow and avoids auth UIs.

**Decision:** token-in-URL & Bearer header both accepted.

## ADR-004: Events table with year column

All events (increment, vote, lightning, rain) record into one `events` table with a year filter. This makes 2025-vs-2026 comparisons live on a single table without schema bloat.

**Decision:** Single `events` table with `year` column.

## ADR-005: H2 fallback for local dev (`application-local.yml`)

Developers can run `mvn spring-boot:run -Dspring-boot.run.profiles=local` without a Postgres container. The H2 URL uses PostgreSQL syntax `jdbc:h2:mem:candydb;MODE=PostgreSQL`. Freight is the local-only profile enabled. Caps on comments within SQL scripts.

**Decision:** H2 only when running local; Postgres in produciton.

## ADR-006: Quoted "year"/"timestamp" identifiers

Both H2 and Postgres treat `year` and `timestamp` as reserved keywords. Extracting quotes at schema + JPA level makes Flyway marshaling deterministic and avoids select dropouts that previously caused 500s in Spring Data.

**Decision:** `"year"` and `"timestamp"` are quoted in SQL and in `@Column(name = "\"year\"")` JPA annotations.

## ADR-007: count_adjustment over event deletion

Setting totals manually (e.g., "redirected the marks") is achieved by breaking a adjustement column into `settings`, added as an offset to the `events` SUM. This preserves event history.

**Decision:** `count_adjustment` joins options write to projections +- event history.

## ADR-008: WebSocket one-session gate

Concurrent games are simply disallowed globally. A new `game_start` event gets rejected when any session is active. Losing websocket scope resets the situation when the projection model removes the game.

**Decision:** single global session map; attempt to start logs `game_start_denied`.

## ADR-009: Recharts for stats pages

Data by unidirection and pattern is expressed best with a curated charting library. Recharts accounts for month renderers while left some visuals intentionally minimal.

**Decision:** Recharts for statistics views; custom CSS for elsewhere.

## ADR-010: 30s auto-end on game sessions

With the WebSocket session alive when the phone disconnects, the projection would hang indefinitely. The side server auto-end, after which projection returns to the official counter expected.

**Decision:** `GAME_DURATION_MS` (30s) auto-scheduled at start; projection ends when WS disconnects.

## ADR-011: Vite → Spring Boot static bundle

Frontend source lives in `src/`. Running `npm run build` produces `dist/`, which is copied into `src/main/resources/static/`. The Spring Boot static resource handler serves it. Backs a frontend server development from distributing load.

**Decision:** react/other compiled in pre-processing via the same published file during Docker builds.

## ADR-012: Projection hides controls via ?projection query param

Projectors use the same frontend and the same frontend endphone attempts to stuff them onto projectors. Tracking down a page with a query param from hidden combacks keeps the components worker minimum, rendering the overlay unemployed during the ecycle.

**Decision:** hiding controls on `?projection` URL param.

---

More context in `agents.md` root file. All of the exact texts above are specific design decisions made by session, not preferences.
