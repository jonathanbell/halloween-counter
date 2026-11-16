package com.halloween.candy_counter.service;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.repository.EventRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CounterService {

    private final EventRepository eventRepository;
    private final SettingsService settingsService;
    private final ApplicationEventPublisher eventPublisher;
    private final GameService gameService;
    private final FreezeService freezeService;

    public CounterService(EventRepository eventRepository,
                          SettingsService settingsService,
                          ApplicationEventPublisher eventPublisher,
                          GameService gameService,
                          FreezeService freezeService) {
        this.eventRepository = eventRepository;
        this.settingsService = settingsService;
        this.eventPublisher = eventPublisher;
        this.gameService = gameService;
        this.freezeService = freezeService;
    }

    @Transactional
    public Event increment(Integer year) {
        freezeService.requireOpen();

        Event event = new Event("increment", year);
        Event saved = eventRepository.save(event);
        eventPublisher.publishEvent(new CounterUpdatedEvent(saved));
        return saved;
    }

    @Transactional
    public Event effectLightning(Integer year) {
        Event event = new Event("effect_lightning", year);
        Event saved = eventRepository.save(event);
        eventPublisher.publishEvent(new EffectEvent(saved, "lightning"));
        return saved;
    }

    @Transactional
    public Event effectCandyRain(Integer year) {
        Event event = new Event("effect_candy_rain", year);
        Event saved = eventRepository.save(event);
        eventPublisher.publishEvent(new EffectEvent(saved, "candy-rain"));
        return saved;
    }

    public Map<String, Object> getState(Integer year) {
        SettingsService.Tally tally = settingsService.tally(year);

        Map<String, Object> state = new HashMap<>();
        state.put("year", year);
        state.put("currentCount", tally.total());
        state.put("initialCandyCount", tally.initialCandyCount());
        state.put("candyRemaining", tally.candyRemaining());
        // Lets a projection or phone refreshed mid-game catch up: who is
        // playing and how long is left (null / 0 when no game is running)
        state.put("gameActive", gameService.isGameActive());
        state.put("gameInitials", gameService.activeInitials());
        state.put("gameEndsInMs", gameService.endsInMs());

        // Off Halloween night every screen swaps its controls for a countdown
        state.put("frozen", freezeService.isFrozen());
        state.put("opensAt", freezeService.opensAt().toString());
        return state;
    }

    // Increments per minute, oldest first: [{minute: "2026-10-31T18:04:00Z", count: 5}]
    public List<Map<String, Object>> histogram(Integer year) {
        List<Event> events = eventRepository.findIncrementsByYear(year);

        Map<Instant, Long> minuteCounts = new HashMap<>();
        for (Event event : events) {
            Instant minute = event.getTimestamp().truncatedTo(ChronoUnit.MINUTES);
            minuteCounts.merge(minute, 1L, (a, b) -> a + b);
        }

        return minuteCounts.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> {
                Map<String, Object> point = new HashMap<>();
                point.put("minute", entry.getKey().toString());
                point.put("count", entry.getValue());
                return point;
            })
            .toList();
    }

    // Published after the save; AFTER_COMMIT listeners re-read the total
    public static class CounterUpdatedEvent {
        private final Event event;

        public CounterUpdatedEvent(Event event) {
            this.event = event;
        }

        public Event getEvent() { return event; }
    }

    public static class EffectEvent {
        private final Event event;
        private final String effectType;

        public EffectEvent(Event event, String effectType) {
            this.event = event;
            this.effectType = effectType;
        }

        public Event getEvent() { return event; }
        public String getEffectType() { return effectType; }
    }
}
