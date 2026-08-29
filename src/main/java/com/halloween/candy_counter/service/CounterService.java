package com.halloween.candy_counter.service;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.repository.EventRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class CounterService {

    private final EventRepository eventRepository;
    private final ApplicationEventPublisher eventPublisher;

    public CounterService(EventRepository eventRepository, ApplicationEventPublisher eventPublisher) {
        this.eventRepository = eventRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public Event increment(Integer year) {
        Event event = new Event("increment", year);
        Event saved = eventRepository.save(event);
        eventPublisher.publishEvent(new CounterUpdatedEvent(saved));
        return saved;
    }

    @Transactional
    public Event vote(Integer year, String candyType) {
        Event event = new Event("vote", year, candyType, null, null);
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

    // Event with all counter-context (after commit listeners should re-read if needed)
    public static class CounterUpdatedEvent {
        private final Event event; // not used in broadcast; just a semantic placeholder.

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
