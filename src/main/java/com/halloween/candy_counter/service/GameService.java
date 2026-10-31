package com.halloween.candy_counter.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.halloween.candy_counter.domain.BonkScore;
import com.halloween.candy_counter.domain.GameSchedule;
import com.halloween.candy_counter.domain.GameStatusEvent;
import com.halloween.candy_counter.domain.Initials;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.security.SecureRandom;
import java.time.Year;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.random.RandomGenerator;

/**
 * Graveyard Bonk. The phone runs the game on its own clock from a schedule
 * sent at start; this class referees and relays.
 *
 * <pre>
 * phone ──pop_shown──> onShown ──game_pop──> projection (SSE)
 * phone ──bonk──────> onBonk  ──game_bonk─> projection, score_update ─> phone
 * phone ──tap───────> onTap   ──game_tap──> projection (throttled)
 * timer ────────────> endGame ──game_result─> projection, game_ended ─> phone
 * phone ──game_quit─> quitGame (endGame, early)
 * </pre>
 */
@Service
public class GameService {

    // Late bonks from the last second still count; the phone stops at 30s
    static final long END_GRACE_MS = 1000;

    // Mashing kids must not flood every SSE subscriber with splats
    static final long TAP_RELAY_INTERVAL_MS = 100;

    // Splats beyond the graveyard are junk input
    private static final double MAX_TAP_COORD = 20;

    private static final int SEND_TIME_LIMIT_MS = 2000;
    private static final int SEND_BUFFER_LIMIT_BYTES = 64 * 1024;

    private final ConcurrentHashMap<String, GameSession> activeSessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(2);
    private final SseBroadcaster sseBroadcaster;
    private final LeaderboardService leaderboardService;
    private final ObjectMapper objectMapper;
    private final RandomGenerator random;

    @Autowired
    public GameService(SseBroadcaster sseBroadcaster, LeaderboardService leaderboardService,
                       ObjectMapper objectMapper) {
        this(sseBroadcaster, leaderboardService, objectMapper, new SecureRandom());
    }

    // Tests pass a seeded generator so schedules are repeatable
    GameService(SseBroadcaster sseBroadcaster, LeaderboardService leaderboardService,
                ObjectMapper objectMapper, RandomGenerator random) {
        this.sseBroadcaster = sseBroadcaster;
        this.leaderboardService = leaderboardService;
        this.objectMapper = objectMapper;
        this.random = random;
    }

    static class GameSession {
        final UUID sessionId = UUID.randomUUID();
        final WebSocketSession socket;
        final String initials;
        final GameSchedule schedule;
        final long endsAt;

        // Touched by the WS thread (shown/bonk/tap) and the end timer
        final Set<Integer> shown = ConcurrentHashMap.newKeySet();
        final Set<Integer> bonked = ConcurrentHashMap.newKeySet();
        final List<Long> reactionsMs = new CopyOnWriteArrayList<>();
        final AtomicInteger score = new AtomicInteger();
        final AtomicLong lastTapRelay = new AtomicLong();
        volatile ScheduledFuture<?> endTask;

        GameSession(WebSocketSession socket, String initials, GameSchedule schedule, long endsAt) {
            this.socket = socket;
            this.initials = initials;
            this.schedule = schedule;
            this.endsAt = endsAt;
        }

        // The running total never drops below zero: bonking Grandma first
        // thing should not leave a kid digging out of a hole
        int addScore(int delta) {
            return score.updateAndGet(s -> Math.max(0, s + delta));
        }
    }

    // Test hook
    @Nullable
    GameSession sessionForTest(String socketId) {
        return activeSessions.get(socketId);
    }

    @Nullable
    public synchronized UUID startGame(WebSocketSession session, @Nullable String rawInitials) {
        // Concurrency gate: one active game at a time. Synchronized so two
        // racing game_start messages cannot both pass the isEmpty check
        if (!activeSessions.isEmpty()) return null;

        // The end timer sends from an executor thread while bonks reply on
        // the WS thread; a raw session throws on concurrent sends
        WebSocketSession socket = new ConcurrentWebSocketSessionDecorator(
            session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT_BYTES);

        String initials = Initials.sanitize(rawInitials);
        GameSchedule schedule = GameSchedule.generate(random);
        long playMs = GameSchedule.COUNTDOWN_MS + GameSchedule.DURATION_MS;
        GameSession game = new GameSession(socket, initials, schedule, System.currentTimeMillis() + playMs);
        activeSessions.put(session.getId(), game);

        // Stored so an early end cancels it; a stale timer would otherwise
        // kill the next game started on the same connection
        game.endTask = executor.schedule(
            () -> endGame(session), playMs + END_GRACE_MS, TimeUnit.MILLISECONDS);

        send(game, startedMessage(game));
        sseBroadcaster.broadcastGameStatus(GameStatusEvent.started(game.sessionId, initials, playMs));
        return game.sessionId;
    }

    private ObjectNode startedMessage(GameSession game) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("type", "game_started");
        msg.put("sessionId", game.sessionId.toString());
        msg.put("initials", game.initials);
        msg.put("countdownMs", GameSchedule.COUNTDOWN_MS);
        msg.put("durationMs", GameSchedule.DURATION_MS);
        msg.put("upMs", GameSchedule.UP_MS);

        ArrayNode pops = msg.putArray("pops");
        for (GameSchedule.Pop pop : game.schedule.pops()) {
            pops.addObject()
                .put("id", pop.id())
                .put("atMs", pop.atMs())
                .put("grave", pop.grave())
                .put("kind", pop.kind().wire());
        }
        return msg;
    }

    // The phone drew this pop: mirror it to the projection
    public void onShown(WebSocketSession session, int popId) {
        GameSession game = activeSessions.get(session.getId());
        if (game == null) return;

        GameSchedule.Pop pop = game.schedule.find(popId).orElse(null);
        if (pop == null || !game.shown.add(popId)) return;

        sseBroadcaster.broadcastGameEvent("game_pop", Map.of(
            "id", pop.id(),
            "grave", pop.grave(),
            "kind", pop.kind().wire()));
    }

    public void onBonk(WebSocketSession session, int popId, long ms) {
        GameSession game = activeSessions.get(session.getId());
        if (game == null) return;

        // Only pops the phone said it drew, and each one exactly once
        GameSchedule.Pop pop = game.schedule.find(popId).orElse(null);
        if (pop == null || !game.shown.contains(popId)) return;
        if (!game.bonked.add(popId)) return;

        BonkScore.Result result = BonkScore.judge(pop.kind(), ms);
        if (result.verdict() == BonkScore.Verdict.BONK) game.reactionsMs.add(ms);
        int score = game.addScore(result.points());

        ObjectNode reply = objectMapper.createObjectNode();
        reply.put("type", "score_update");
        reply.put("id", popId);
        reply.put("verdict", result.verdict().wire());
        reply.put("points", result.points());
        reply.put("score", score);
        send(game, reply);

        sseBroadcaster.broadcastGameEvent("game_bonk", Map.of(
            "id", popId,
            "grave", pop.grave(),
            "kind", pop.kind().wire(),
            "verdict", result.verdict().wire(),
            "ms", ms,
            "points", result.points(),
            "score", score));
    }

    // A tap that hit nothing, in world coordinates so the projection's
    // camera can draw the splat on the same spot of grass
    public void onTap(WebSocketSession session, double x, double z) {
        GameSession game = activeSessions.get(session.getId());
        if (game == null) return;
        if (!Double.isFinite(x) || !Double.isFinite(z)) return;
        if (Math.abs(x) > MAX_TAP_COORD || Math.abs(z) > MAX_TAP_COORD) return;

        long now = System.currentTimeMillis();
        long last = game.lastTapRelay.get();
        if (now - last < TAP_RELAY_INTERVAL_MS) return;
        if (!game.lastTapRelay.compareAndSet(last, now)) return;

        sseBroadcaster.broadcastGameEvent("game_tap", Map.of("x", x, "z", z));
    }

    // Exposed on /api/state so a projection or phone refreshed mid-game can
    // catch up instead of waiting for the next game_status message
    public boolean isGameActive() {
        return !activeSessions.isEmpty();
    }

    @Nullable
    public String activeInitials() {
        return activeSessions.values().stream().findFirst().map(g -> g.initials).orElse(null);
    }

    public long endsInMs() {
        return activeSessions.values().stream()
            .findFirst()
            .map(g -> Math.max(0, g.endsAt - System.currentTimeMillis()))
            .orElse(0L);
    }

    public void endGame(WebSocketSession session) {
        GameSession game = activeSessions.remove(session.getId());
        if (game == null) return;

        // cancel(false): the end timer itself runs endGame and must not
        // interrupt its own thread mid-send
        ScheduledFuture<?> endTask = game.endTask;
        if (endTask != null) endTask.cancel(false);

        int score = game.score.get();
        Integer avgMs = averageMs(game.reactionsMs);
        LeaderboardService.Placement placement = persist(game, score, avgMs);

        sseBroadcaster.broadcastGameStatus(GameStatusEvent.ended(game.sessionId, game.initials));

        Map<String, Object> result = new HashMap<>();
        result.put("initials", game.initials);
        result.put("score", score);
        result.put("avgMs", avgMs);
        result.put("rank", placement != null ? placement.rank() : null);
        result.put("scoreId", placement != null ? placement.scoreId() : null);
        sseBroadcaster.broadcastGameEvent("game_result", result);

        ObjectNode ended = objectMapper.valueToTree(result);
        ended.put("type", "game_ended");
        send(game, ended);
    }

    public void handleDisconnect(WebSocketSession session) {
        endGame(session);
    }

    // The player ended early: same as closing the tab, the score counts
    public void quitGame(WebSocketSession session) {
        endGame(session);
    }

    // Games where nothing ever popped (closed during the countdown) stay off
    // the leaderboard. A failed save is non-critical: the game still ends
    @Nullable
    private LeaderboardService.Placement persist(GameSession game, int score, @Nullable Integer avgMs) {
        if (game.shown.isEmpty()) return null;
        try {
            return leaderboardService.record(Year.now().getValue(), game.sessionId, score, game.initials, avgMs);
        } catch (Exception ignored) {
            return null;
        }
    }

    @Nullable
    private static Integer averageMs(List<Long> reactionsMs) {
        if (reactionsMs.isEmpty()) return null;
        double avg = reactionsMs.stream().mapToLong(Long::longValue).average().orElse(0);
        return (int) Math.round(avg);
    }

    private void send(GameSession game, ObjectNode msg) {
        try {
            game.socket.sendMessage(new TextMessage(objectMapper.writeValueAsString(msg)));
        } catch (Exception ignored) {}
    }

    @PreDestroy
    public void shutdown() {
        for (GameSession game : activeSessions.values()) {
            ScheduledFuture<?> endTask = game.endTask;
            if (endTask != null) endTask.cancel(false);
        }
        activeSessions.clear();
        executor.shutdownNow();
    }
}
