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
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SseBroadcaster {

    private final List<SseEmitter> subscribers = new CopyOnWriteArrayList<>();
    private final EventRepository eventRepository;
    private final SettingsRepository settingsRepository;
    private final ObjectMapper objectMapper;

    public SseBroadcaster(EventRepository eventRepository,
                          SettingsRepository settingsRepository,
                          ObjectMapper objectMapper) {
        this.eventRepository = eventRepository;
        this.settingsRepository = settingsRepository;
        this.objectMapper = objectMapper;
    }

    public SseEmitter subscribe() {
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
        Long eventTotal = eventRepository.sumIncrementsByYear(year);
        int adjustment = settingsRepository.findByYear(year)
            .map(s -> s.getCountAdjustment() != null ? s.getCountAdjustment() : 0)
            .orElse(0);
        long total = (eventTotal != null ? eventTotal : 0L) + adjustment;

        EventMessage envelope = new EventMessage(
            event.getEvent().getType(),
            year,
            (int) total,
            event.getEvent().getTimestamp()
        );

        sendToSubscribers(envelope);
    }

    public void broadcastCountSnapshot(Integer year) {
        if (subscribers.isEmpty()) return;
        Long eventTotal = eventRepository.sumIncrementsByYear(year);
        int adjustment = settingsRepository.findByYear(year)
            .map(s -> s.getCountAdjustment() != null ? s.getCountAdjustment() : 0)
            .orElse(0);
        long total = (eventTotal != null ? eventTotal : 0L) + adjustment;
        EventMessage envelope = new EventMessage("increment", year, (int) total, java.time.Instant.now());
        sendToSubscribers(envelope);
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
        payload.put("timestamp", java.time.Instant.now().toString());
        sendToSubscribers(payload);
    }

    public void broadcastZombieMissed(String zombieId) {
        if (subscribers.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "zombie_missed");
        payload.put("zombieId", zombieId);
        payload.put("timestamp", java.time.Instant.now().toString());
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
            try {
                emitter.send(payload);
            } catch (IOException ignored) {
                // subscriber disconnected — reactive cleanup happens in onError
            }
        }
    }

    @PreDestroy
    public void cleanup() {
        for (SseEmitter e : subscribers) {
            try { e.complete(); } catch (Exception ignored) {}
        }
        subscribers.clear();
    }
}
