package com.halloween.candy_counter.service;

import com.halloween.candy_counter.domain.EventMessage;
import com.halloween.candy_counter.repository.EventRepository;
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
    private final ObjectMapper objectMapper;

    public SseBroadcaster(EventRepository eventRepository, ObjectMapper objectMapper) {
        this.eventRepository = eventRepository;
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

        // Reload totals within the view (heavy query every event).
        Long total = eventRepository.sumIncrementsByYear(event.getEvent().getYear());
        EventMessage envelope = new EventMessage(
            event.getEvent().getType(),
            event.getEvent().getYear(),
            total != null ? total.intValue() : null,
            event.getEvent().getTimestamp()
        );

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
