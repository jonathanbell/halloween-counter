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

    public GameService(SseBroadcaster sseBroadcaster) {
        this.sseBroadcaster = sseBroadcaster;
    }

    public static class GameSession {
        private final UUID sessionId;
        private final WebSocketSession session;
        private final Map<Long, ZombieSpawn> zombieSpawns = new HashMap<>();
        private int score = 0;
        private ScheduledFuture<?> cleanupTask;

        public GameSession(UUID sessionId, WebSocketSession session) {
            this.sessionId = sessionId;
            this.session = session;
        }

        public UUID getSessionId() { return sessionId; }
        public WebSocketSession getSession() { return session; }
        public Map<Long, ZombieSpawn> getZombieSpawns() { return zombieSpawns; }
        public int getScore() { return score; }
        public void addScore(int delta) { score += delta; }
        public void setCleanupTask(ScheduledFuture<?> task) { this.cleanupTask = task; }
        public ScheduledFuture<?> getCleanupTask() { return cleanupTask; }
    }

    public static class ZombieSpawn {
        public final long zombieId;
        public final int direction; // 0=left, 1=right
        public final long spawnTime;
        public final long ttlMs = 3000;

        public ZombieSpawn(long zombieId, int direction, long spawnTime) {
            this.zombieId = zombieId;
            this.direction = direction;
            this.spawnTime = spawnTime;
        }

        public boolean isValid(long now) {
            return (now - spawnTime) < ttlMs;
        }
    }

    public @Nullable UUID startGame(WebSocketSession session) {
        // Prevent concurrent game starts in the same pixel zone
        if (!activeSessions.isEmpty()) return null;

        UUID sessionId = UUID.randomUUID();
        GameSession gameSession = new GameSession(sessionId, session);
        String key = session.getId();
        activeSessions.put(key, gameSession);
        // Announce game mode to SSE projection
        notifyGameStatus(true, sessionId);

        // Schedule zombie spawn generator (every ~800ms is roughly "fast-paced")
        ScheduledFuture<?> spawnTask = executor.scheduleWithFixedDelay(
            () -> spawnZombie(gameSession), 300, 800, TimeUnit.MILLISECONDS);
        gameSession.setCleanupTask(spawnTask);

        return sessionId;
    }

    public void processZombieHit(WebSocketSession session, @Nullable String zombieId) {
        GameSession sessionState = activeSessions.get(session.getId());
        if (sessionState == null) return;

        if (zombieId == null) {
            // hit nothing? decrease score -1
            sessionState.addScore(-1);
            return;
        }

        try {
            long zombieKey = Long.parseLong(zombieId);
            ZombieSpawn spawn = sessionState.getZombieSpawns().get(zombieKey);
            if (spawn == null || !spawn.isValid(System.currentTimeMillis())) {
                sessionState.addScore(-1);
                return;
            }

            // Hit correctly: +1 point
            sessionState.addScore(1);
            sessionState.getZombieSpawns().remove(zombieKey);
        } catch (Exception e) {
            // invalid scoredive - ignore scoring influence
        }
    }

    public void endGame(WebSocketSession session) {
        GameSession sessionState = activeSessions.remove(session.getId());
        if (sessionState == null) return;

        ScheduledFuture<?> task = sessionState.getCleanupTask();
        if (task != null) task.cancel(true);

        // announce the score back
        Integer finalScore = sessionState.getScore();
        notifyGameStatus(false, sessionState.getSessionId());

        try {
            session.sendMessage(new org.springframework.web.socket.TextMessage(
                "{\"type\":\"game_ended\",\"score\":" + finalScore + "}"
            ));
        } catch (Exception ignored) {}
    }

    public void handleDisconnect(WebSocketSession session) {
        // Disable game upon disconnect
        endGame(session);
    }

    private void spawnZombie(GameSession sessionState) {
        // Spawn on LEFT or RIGHT sometimes
        int direction = Math.random() < 0.5 ? 0 : 1;

        // Assign ID (rotating helper)
        long zombieId = System.nanoTime();
        ZombieSpawn spawn = new ZombieSpawn(zombieId, direction, System.currentTimeMillis());
        sessionState.getZombieSpawns().put(zombieId, spawn);

        // Send spawn event over WebSocket with sufficient CRUD context ?
        try {
            sessionState.getSession().sendMessage(new org.springframework.web.socket.TextMessage(
                String.format("{\"type\":\"zombie_spawned\",\"zombieId\":\"%d\",\"direction\":%d}", zombieId, direction)
            ));
        } catch (Exception ignored) {}
    }

    private void notifyGameStatus(boolean active, UUID sessionId) {
        // Tell projection directly that the game is underway, without touching DB
        com.halloween.candy_counter.domain.GameStatusEvent event =
            new com.halloween.candy_counter.domain.GameStatusEvent(active, sessionId);
        sseBroadcaster.broadcastGameStatus(event);
    }
}
