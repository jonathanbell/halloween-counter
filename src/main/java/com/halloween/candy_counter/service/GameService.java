package com.halloween.candy_counter.service;

import com.halloween.candy_counter.domain.GameStatusEvent;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.Map;
import java.util.HashMap;

@Service
public class GameService {

    private final ConcurrentHashMap<String, GameSession> activeSessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(4);
    private final SseBroadcaster sseBroadcaster;

    static final long ZOMBIE_TTL_MS = 3000;
    static final long SPAWN_INTERVAL_MS = 600;
    static final long INITIAL_SPAWN_DELAY_MS = 300;
    static final long RESOLVE_INTERVAL_MS = 500;
    static final long RESOLVE_GRACE_MS = 100;
    static final long GAME_DURATION_MS = 30_000;
    static final int HIT_SCORE = 1;
    static final int MISS_SCORE = -1;
    static final int MAX_CONCURRENT_ZOMBIES = 3;

    // PRD complexity states: easy = one zombie at a time, hard = up to 3
    // concurrent, lightning = one fast zombie worth double points.
    public enum Difficulty {
        EASY(SPAWN_INTERVAL_MS, ZOMBIE_TTL_MS, HIT_SCORE, 1),
        HARD(400, 2000, HIT_SCORE, MAX_CONCURRENT_ZOMBIES),
        LIGHTNING(500, 1500, 2, 1);

        final long spawnIntervalMs;
        final long zombieTtlMs;
        final int hitScore;
        final int maxConcurrent;

        Difficulty(long spawnIntervalMs, long zombieTtlMs, int hitScore, int maxConcurrent) {
            this.spawnIntervalMs = spawnIntervalMs;
            this.zombieTtlMs = zombieTtlMs;
            this.hitScore = hitScore;
            this.maxConcurrent = maxConcurrent;
        }
    }

    // Test hook: exposes sessions for unit tests
    Map<String, GameSession> getSessionsForTest() {
        return activeSessions;
    }

    public GameService(SseBroadcaster sseBroadcaster) {
        this.sseBroadcaster = sseBroadcaster;
    }

    public static class ZombieSpawn {
        public final long zombieId;
        public final int direction; // 0=left, 1=right
        public final long spawnTime;

        public ZombieSpawn(long zombieId, int direction, long spawnTime) {
            this.zombieId = zombieId;
            this.direction = direction;
            this.spawnTime = spawnTime;
        }

        public boolean isExpired(long now, long ttlMs) {
            return (now - spawnTime) >= ttlMs;
        }
    }

    public static class GameSession {
        private final UUID sessionId;
        private final WebSocketSession session;
        private final Difficulty difficulty;
        private final Map<Long, ZombieSpawn> zombieSpawns = new HashMap<>();
        private int score = 0;
        private ScheduledFuture<?> spawnTask;
        private ScheduledFuture<?> resolveTask;

        public GameSession(UUID sessionId, WebSocketSession session, Difficulty difficulty) {
            this.sessionId = sessionId;
            this.session = session;
            this.difficulty = difficulty;
        }

        public UUID getSessionId() { return sessionId; }
        public WebSocketSession getSession() { return session; }
        public Difficulty getDifficulty() { return difficulty; }
        public Map<Long, ZombieSpawn> getZombieSpawns() { return zombieSpawns; }
        public int getScore() { return score; }
        public void addScore(int delta) { score += delta; }

        public void setSpawnTask(ScheduledFuture<?> task) { this.spawnTask = task; }
        public void setResolveTask(ScheduledFuture<?> task) { this.resolveTask = task; }
        public ScheduledFuture<?> getSpawnTask() { return spawnTask; }
        public ScheduledFuture<?> getResolveTask() { return resolveTask; }
    }

    @Nullable
    public UUID startGame(WebSocketSession session) {
        return startGame(session, Difficulty.EASY);
    }

    @Nullable
    public UUID startGame(WebSocketSession session, Difficulty difficulty) {
        // Concurrency gate: one active game at a time
        if (!activeSessions.isEmpty()) return null;

        UUID sessionId = UUID.randomUUID();
        GameSession gameSession = new GameSession(sessionId, session, difficulty);
        activeSessions.put(session.getId(), gameSession);

        // Announce game mode to SSE clients
        broadcastGameStatus(true, sessionId);

        ScheduledFuture<?> spawnTask = executor.scheduleWithFixedDelay(
            () -> spawnZombie(gameSession),
            INITIAL_SPAWN_DELAY_MS,
            difficulty.spawnIntervalMs,
            TimeUnit.MILLISECONDS);
        gameSession.setSpawnTask(spawnTask);

        ScheduledFuture<?> resolveTask = executor.scheduleWithFixedDelay(
            () -> resolveMissedZombies(gameSession),
            difficulty.zombieTtlMs + RESOLVE_GRACE_MS,
            RESOLVE_INTERVAL_MS,
            TimeUnit.MILLISECONDS);
        gameSession.setResolveTask(resolveTask);

        // Auto-end after GAME_DURATION_MS so the projection returns to counter
        executor.schedule(() -> endGame(session), GAME_DURATION_MS, TimeUnit.MILLISECONDS);

        return sessionId;
    }

    public void processZombieHit(WebSocketSession session, @Nullable String zombieId) {
        GameSession sessionState = activeSessions.get(session.getId());
        if (sessionState == null) return;

        if (zombieId == null) {
            sessionState.addScore(MISS_SCORE);
            sendScoreUpdate(sessionState, "miss");
            return;
        }

        try {
            long zombieKey = Long.parseLong(zombieId);
            Difficulty difficulty = sessionState.getDifficulty();
            ZombieSpawn spawn = sessionState.getZombieSpawns().get(zombieKey);
            if (spawn == null || spawn.isExpired(System.currentTimeMillis(), difficulty.zombieTtlMs)) {
                sessionState.addScore(MISS_SCORE);
                sendScoreUpdate(sessionState, "miss");
                return;
            }

            // Hit
            sessionState.addScore(difficulty.hitScore);
            sessionState.getZombieSpawns().remove(zombieKey);

            // Flash lightning on the projection as hit feedback
            sseBroadcaster.broadcastEffectLightningFlash();
            sendScoreUpdate(sessionState, "hit");
        } catch (Exception ignored) {}
    }

    private void sendScoreUpdate(GameSession sessionState, String result) {
        try {
            sessionState.getSession().sendMessage(new org.springframework.web.socket.TextMessage(
                String.format("{\"type\":\"score_update\",\"result\":\"%s\",\"score\":%d}",
                    result, sessionState.getScore())
            ));
        } catch (Exception ignored) {}
    }

    public void endGame(WebSocketSession session) {
        GameSession sessionState = activeSessions.remove(session.getId());
        if (sessionState == null) return;

        cancelTasks(sessionState);

        Integer finalScore = sessionState.getScore();
        broadcastGameStatus(false, sessionState.getSessionId());

        try {
            session.sendMessage(new org.springframework.web.socket.TextMessage(
                "{\"type\":\"game_ended\",\"score\":" + finalScore + "}"
            ));
        } catch (Exception ignored) {}
    }

    public void handleDisconnect(WebSocketSession session) {
        endGame(session);
    }

    private void spawnZombie(GameSession gameSession) {
        // Difficulty cap: skip this tick while enough zombies are alive
        if (gameSession.getZombieSpawns().size() >= gameSession.getDifficulty().maxConcurrent) return;

        int direction = Math.random() < 0.5 ? 0 : 1;
        long zombieId = System.nanoTime();
        ZombieSpawn spawn = new ZombieSpawn(zombieId, direction, System.currentTimeMillis());
        gameSession.getZombieSpawns().put(zombieId, spawn);

        // Mirror spawn to SSE subscribers so the projection renders visuals
        sseBroadcaster.broadcastZombieSpawned(String.valueOf(zombieId), direction);

        try {
            gameSession.getSession().sendMessage(new org.springframework.web.socket.TextMessage(
                String.format("{\"type\":\"zombie_spawned\",\"zombieId\":\"%d\",\"direction\":%d}",
                    zombieId, direction)
            ));
        } catch (Exception ignored) {}
    }

    private void resolveMissedZombies(GameSession gameSession) {
        Map<Long, ZombieSpawn> spawns = gameSession.getZombieSpawns();
        long now = System.currentTimeMillis();
        long ttlMs = gameSession.getDifficulty().zombieTtlMs;

        spawns.entrySet().removeIf(entry -> {
            ZombieSpawn spawn = entry.getValue();
            if (!spawn.isExpired(now, ttlMs)) return false;

            gameSession.addScore(MISS_SCORE);
            sseBroadcaster.broadcastZombieMissed(String.valueOf(spawn.zombieId));
            try {
                gameSession.getSession().sendMessage(new org.springframework.web.socket.TextMessage(
                    String.format("{\"type\":\"zombie_missed\",\"zombieId\":\"%d\"}", spawn.zombieId)
                ));
                sendScoreUpdate(gameSession, "miss");
            } catch (Exception ignored) {}
            return true;
        });
    }

    private void cancelTasks(GameSession sessionState) {
        ScheduledFuture<?> spawnTask = sessionState.getSpawnTask();
        if (spawnTask != null) spawnTask.cancel(true);

        ScheduledFuture<?> resolveTask = sessionState.getResolveTask();
        if (resolveTask != null) resolveTask.cancel(true);
    }

    private void broadcastGameStatus(boolean active, UUID sessionId) {
        GameStatusEvent event = new GameStatusEvent(active, sessionId);
        sseBroadcaster.broadcastGameStatus(event);
    }
}