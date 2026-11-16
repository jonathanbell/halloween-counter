package com.halloween.candy_counter.service;

import com.halloween.candy_counter.domain.EventMessage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.halloween.candy_counter.domain.GameSchedule;
import com.halloween.candy_counter.domain.GameStatusEvent;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class SseBroadcaster {

    // Comment frames keep idle connections alive through proxies and mobile
    // networks that kill silent streams; EventSource ignores them
    private static final long HEARTBEAT_INTERVAL_MS = 15_000;
    private static final int MAX_SUBSCRIBERS = 100;

    // Midnight, an unlock and its expiry all show up as "the answer
    // changed", so one watcher covers every way the freeze can flip
    private static final long FREEZE_WATCH_INTERVAL_MS = 1_000;

    private static final CompletableFuture<Void> DONE = CompletableFuture.completedFuture(null);

    private final List<SseEmitter> subscribers = new CopyOnWriteArrayList<>();

    // Each screen gets its own send chain: messages arrive in the order they
    // were sent (a bonk never beats its pop), and a stalled phone only holds
    // up its own chain instead of a pool thread per message
    private final Map<SseEmitter, CompletableFuture<Void>> lanes = new ConcurrentHashMap<>();

    private final SettingsService settingsService;
    private final FreezeService freezeService;
    private final ObjectMapper objectMapper;

    private boolean lastFrozen;

    private final ScheduledExecutorService heartbeatExecutor =
        Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "sse-heartbeat");
            t.setDaemon(true);
            return t;
        });

    private final ExecutorService broadcastExecutor =
        Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "sse-broadcast");
            t.setDaemon(true);
            return t;
        });

    public SseBroadcaster(SettingsService settingsService, FreezeService freezeService,
                          ObjectMapper objectMapper) {
        this.settingsService = settingsService;
        this.freezeService = freezeService;
        this.objectMapper = objectMapper;
        this.lastFrozen = freezeService.isFrozen();

        heartbeatExecutor.scheduleWithFixedDelay(this::sendHeartbeats,
            HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS, TimeUnit.MILLISECONDS);
        heartbeatExecutor.scheduleWithFixedDelay(this::announceFreezeFlip,
            FREEZE_WATCH_INTERVAL_MS, FREEZE_WATCH_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    // Open pages swap between their controls and the countdown without a
    // reload. Catches everything: a scheduled task that throws never runs
    // again, and that would end the flips silently
    synchronized void announceFreezeFlip() {
        try {
            boolean frozen = freezeService.isFrozen();
            if (frozen == lastFrozen) return;
            lastFrozen = frozen;

            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "freeze");
            payload.put("frozen", frozen);
            payload.put("opensAt", freezeService.opensAt().toString());
            payload.put("timestamp", Instant.now().toString());
            sendToSubscribers(payload);
        } catch (Exception ignored) {}
    }

    public SseEmitter subscribe() {
        if (subscribers.size() >= MAX_SUBSCRIBERS) {
            SseEmitter rejected = new SseEmitter(0L);
            rejected.completeWithError(new RuntimeException("Too many subscribers"));
            return rejected;
        }

        SseEmitter emitter = new SseEmitter(0L); // no timeout
        subscribers.add(emitter);

        emitter.onCompletion(() -> drop(emitter));
        emitter.onTimeout(() -> drop(emitter));
        emitter.onError((ex) -> drop(emitter));

        return emitter;
    }

    // Test hook: a recording emitter, without a servlet response behind it
    void subscribeForTest(SseEmitter emitter) {
        subscribers.add(emitter);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void broadcast(CounterService.CounterUpdatedEvent event) {
        if (subscribers.isEmpty()) return;

        Integer year = event.getEvent().getYear();
        SettingsService.Tally tally = settingsService.tally(year);

        EventMessage envelope = new EventMessage(
            event.getEvent().getType(),
            year,
            (int) tally.total(),
            tally.initialCandyCount(),
            event.getEvent().getTimestamp()
        );

        sendToSubscribers(envelope);
    }

    public void broadcastCountSnapshot(Integer year) {
        if (subscribers.isEmpty()) return;
        // initialCandyCount rides along on every count message so clients
        // track supply changes from the settings page without a refresh
        SettingsService.Tally tally = settingsService.tally(year);
        EventMessage envelope = new EventMessage("increment", year, (int) tally.total(),
            tally.initialCandyCount(), Instant.now());
        sendToSubscribers(envelope);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void broadcastEffect(CounterService.EffectEvent event) {
        if (subscribers.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>();
        String type = "lightning".equals(event.getEffectType())
            ? "effect_lightning" : "effect_candy_rain";
        payload.put("type", type);
        payload.put("year", event.getEvent().getYear());
        payload.put("timestamp", event.getEvent().getTimestamp().toString());
        sendToSubscribers(payload);
    }

    public void broadcastGameStatus(GameStatusEvent event) {
        if (subscribers.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "game_status");
        payload.put("active", event.isActive());
        payload.put("sessionId", event.getSessionId() != null ? event.getSessionId().toString() : null);
        payload.put("initials", event.getInitials());
        payload.put("endsInMs", event.getEndsInMs());
        payload.put("upMs", GameSchedule.UP_MS);
        payload.put("zombieCount", GameSchedule.ZOMBIE_COUNT);
        payload.put("timestamp", event.getTimestamp().toString());
        sendToSubscribers(payload);
    }

    // In-game relay for the projection: game_pop, game_bonk, game_tap,
    // game_result. GameService decides the fields; this adds type + time
    public void broadcastGameEvent(String type, Map<String, ?> fields) {
        if (subscribers.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>(fields);
        payload.put("type", type);
        payload.put("timestamp", Instant.now().toString());
        sendToSubscribers(payload);
    }

    @SuppressWarnings("null")
    private void sendToSubscribers(Object obj) {
        String payload;
        try {
            payload = objectMapper.writeValueAsString(obj);
        } catch (Exception ignored) {
            return;
        }

        for (SseEmitter emitter : subscribers) {
            lanes.compute(emitter, (e, tail) -> (tail != null ? tail : DONE)
                .thenRunAsync(() -> send(e, payload), broadcastExecutor));
        }
    }

    private void send(SseEmitter emitter, String payload) {
        try {
            emitter.send(payload);
        } catch (Exception ignored) {
            drop(emitter);
        }
    }

    private void drop(SseEmitter emitter) {
        subscribers.remove(emitter);
        lanes.remove(emitter);
    }

    private void sendHeartbeats() {
        for (SseEmitter emitter : subscribers) {
            try {
                emitter.send(SseEmitter.event().comment("keep-alive"));
            } catch (Exception ignored) {
                drop(emitter);
            }
        }
    }

    @PreDestroy
    public void cleanup() {
        heartbeatExecutor.shutdownNow();
        broadcastExecutor.shutdownNow();
        for (SseEmitter e : subscribers) {
            try { e.complete(); } catch (Exception ignored) {}
        }
        subscribers.clear();
        lanes.clear();
    }
}
