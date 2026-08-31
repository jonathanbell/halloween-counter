package com.halloween.candy_counter.service;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.model.Settings;
import com.halloween.candy_counter.repository.EventRepository;
import com.halloween.candy_counter.repository.SettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.openMocks;

class CounterServiceTest {

    @Mock EventRepository eventRepository;
    @Mock SettingsRepository settingsRepository;
    @Mock ApplicationEventPublisher eventPublisher;
    @Mock GameService gameService;

    CounterService service;

    @BeforeEach
    void setUp() {
        openMocks(this);
        service = new CounterService(eventRepository, settingsRepository, eventPublisher, gameService);
    }

    @Test
    @SuppressWarnings("null")
    void incrementSavesIncrementEvent() {
        Event saved = new Event("increment", 2026);
        when(eventRepository.save(any(Event.class))).thenReturn(saved);

        Event result = service.increment(2026);

        assertEquals("increment", result.getType());
        verify(eventRepository).save(argThat(e -> "increment".equals(e.getType()) && e.getYear() == 2026));
        verify(eventPublisher).publishEvent(any(CounterService.CounterUpdatedEvent.class));
    }

    @Test
    @SuppressWarnings("null")
    void voteSavesCandyType() {
        Event saved = new Event("vote", 2026, "snickers", null, null);
        when(eventRepository.save(any(Event.class))).thenReturn(saved);

        Event result = service.vote(2026, "snickers");

        assertEquals("vote", result.getType());
        assertEquals("snickers", result.getCandyType());
        verify(eventRepository).save(argThat(e -> "snickers".equals(e.getCandyType())));
    }

    @Test
    void getStateAggregatesEventsAndAdjustment() {
        when(eventRepository.countIncrementsByYear(2026)).thenReturn(100L);
        Settings s = new Settings(2026, 300);
        s.setCountAdjustment(5);
        when(settingsRepository.findByYear(2026)).thenReturn(Optional.of(s));

        Map<String, Object> state = service.getState(2026);

        assertEquals(105L, state.get("currentCount"));
        assertEquals(195L, state.get("candyRemaining"));
        assertEquals(300, state.get("initialCandyCount"));
        assertEquals(false, state.get("gameActive"));
    }

    @Test
    void getStateReportsActiveGame() {
        when(eventRepository.countIncrementsByYear(2026)).thenReturn(0L);
        when(settingsRepository.findByYear(2026)).thenReturn(Optional.empty());
        when(gameService.isGameActive()).thenReturn(true);

        Map<String, Object> state = service.getState(2026);

        assertEquals(true, state.get("gameActive"));
    }

    @Test
    void getStateDefaultsWhenSettingsMissing() {
        when(eventRepository.countIncrementsByYear(2026)).thenReturn(null);
        when(settingsRepository.findByYear(2026)).thenReturn(Optional.empty());

        Map<String, Object> state = service.getState(2026);

        assertEquals(0L, state.get("currentCount"));
        assertEquals(300, state.get("initialCandyCount"));
    }
}
