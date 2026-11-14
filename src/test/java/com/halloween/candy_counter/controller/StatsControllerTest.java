package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.repository.EventRepository;
import com.halloween.candy_counter.repository.SettingsRepository;
import com.halloween.candy_counter.service.CounterService;
import com.halloween.candy_counter.service.GameService;
import com.halloween.candy_counter.service.SettingsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.MockitoAnnotations.openMocks;

class StatsControllerTest {

    @Mock EventRepository eventRepository;
    @Mock SettingsRepository settingsRepository;

    StatsController controller;

    @BeforeEach
    void setUp() {
        openMocks(this);
        SettingsService settingsService = new SettingsService(settingsRepository, eventRepository);
        CounterService counterService = new CounterService(
            eventRepository, settingsService, mock(ApplicationEventPublisher.class), mock(GameService.class));
        controller = new StatsController(counterService, settingsService);
    }

    @Test
    void statsOnlyExposeCountAndHistogram() {
        when(eventRepository.countIncrementsByYear(2026)).thenReturn(42L);
        when(settingsRepository.findByYear(2026)).thenReturn(Optional.empty());
        when(eventRepository.findIncrementsByYear(2026)).thenReturn(List.of());

        ResponseEntity<Map<String, Object>> response = controller.getStats(2026);
        Map<String, Object> body = response.getBody();

        assertNotNull(body);
        assertEquals(Set.of("total", "histogram"), body.keySet());
        assertEquals(42L, body.get("total"));
        assertEquals(List.of(), body.get("histogram"));
    }
}
