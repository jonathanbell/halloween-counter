package com.halloween.candy_counter.service;

import com.halloween.candy_counter.domain.EventMessage;
import com.halloween.candy_counter.repository.EventRepository;
import com.halloween.candy_counter.repository.SettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.halloween.candy_counter.domain.GameStatusEvent;
import com.halloween.candy_counter.model.Settings;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class SseBroadcaster {

    // Comment frames keep idle connections alive through proxies (Tailscale
    // Funnel and friends kill silent streams); EventSource ignores them
    private static final long HEARTBEAT_INTERVAL_MS = 15_000;
    private static final int MAX_SUBSCRIBERS = 100;

    private final List<SseEmitter> subscribers = new CopyOnWriteArrayList<>();
    private final EventRepository eventRepository;
    private final SettingsRepository settingsRepository;
    private final ObjectMapper objectMapper;

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

    public SseBroadcaster(EventRepository eventRepository,
                          SettingsRepository settingsRepository,
                          ObjectMapper objectMapper) {
        this.eventRepository = eventRepository;
        this.settingsRepository = settingsRepository;
        this.objectMapper = objectMapper;
        heartbeatExecutor.scheduleWithFixedDelay(this::sendHeartbeats,
            HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    public SseEmitter subscribe() {
        if (subscribers.size() >= MAX_SUBSCRIBERS) {
            SseEmitter rejected = new SseEmitter(0L);
            rejected.completeWithError(new RuntimeException("Too many subscribers"));
            return rejected;
        }

        SseEmitter emitter = new SseEmitter(0L); // no timeout
        subscribers.add(emitter);

        emitter.onCompletion(() -> subscribers.remove(emitter));
        emitter.onTimeout(() -> subscribers.remove(emitter));
        emitter.onError((ex) -> subscribers.remove(emitter));

        return emitter;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void broadcast(CounterService.CounterUpdatedEvent event) {
        if (subscribers.isEmpty()) return;

        Integer year = event.getEvent().getYear();
        CountState count = countState(year);

        EventMessage envelope = new EventMessage(
            event.getEvent().getType(),
            year,
            count.total(),
            count.initialCandyCount(),
            event.getEvent().getTimestamp()
        );

        sendToSubscribers(envelope);
    }

    public void broadcastCountSnapshot(Integer year) {
        if (subscribers.isEmpty()) return;
        CountState count = countState(year);
        EventMessage envelope = new EventMessage("increment", year, count.total(),
            count.initialCandyCount(), Instant.now());
        sendToSubscribers(envelope);
    }

    // initialCandyCount rides along on every count message so clients track
    // supply changes from the settings page without a refresh
    private record CountState(int total, int initialCandyCount) {}

    private CountState countState(Integer year) {
        Long eventTotal = eventRepository.countIncrementsByYear(year);
        Optional<Settings> settings = settingsRepository.findByYear(year);
        int adjustment = settings
            .map(s -> s.getCountAdjustment() != null ? s.getCountAdjustment() : 0)
            .orElse(0);
        int initialCandy = settings
            .map(s -> s.getInitialCandyCount() != null ? s.getInitialCandyCount() : 300)
            .orElse(300);
        long total = (eventTotal != null ? eventTotal : 0L) + adjustment;
        return new CountState((int) total, initialCandy);
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
        payload.put("timestamp", event.getTimestamp().toString());
        sendToSubscribers(payload);
    }

    public void broadcastZombieSpawned(String zombieId, int direction) {
        if (subscribers.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "zombie_spawned");
        payload.put("zombieId", zombieId);
        payload.put("direction", direction);
        payload.put("timestamp", Instant.now().toString());
        sendToSubscribers(payload);
    }

    public void broadcastZombieMissed(String zombieId) {
        if (subscribers.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "zombie_missed");
        payload.put("zombieId", zombieId);
        payload.put("timestamp", Instant.now().toString());
        sendToSubscribers(payload);
    }

    public void broadcastEffectLightningFlash() {
        if (subscribers.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "effect_lightning");
        payload.put("timestamp", Instant.now().toString());
        sendToSubscribers(payload);
    }

    private void sendToSubscribers(Object obj) {
        String payload;
        try {
            payload = objectMapper.writeValueAsString(obj);
        } catch (Exception ignored) {
            return;
        }

        for (SseEmitter emitter : subscribers) {
            CompletableFuture.runAsync(() -> {
                try {
                    emitter.send(payload);
                } catch (Exception ignored) {
                    subscribers.remove(emitter);
                }
            }, broadcastExecutor);
        }
    }

    private void sendHeartbeats() {
        for (SseEmitter emitter : subscribers) {
            try {
                emitter.send(SseEmitter.event().comment("keep-alive"));
            } catch (Exception ignored) {
                subscribers.remove(emitter);
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
    }
}
