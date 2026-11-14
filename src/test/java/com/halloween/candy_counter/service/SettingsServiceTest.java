package com.halloween.candy_counter.service;

import com.halloween.candy_counter.model.Settings;
import com.halloween.candy_counter.repository.EventRepository;
import com.halloween.candy_counter.repository.SettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.openMocks;

class SettingsServiceTest {

    @Mock SettingsRepository repo;
    @Mock EventRepository events;
    SettingsService service;

    @BeforeEach
    @SuppressWarnings("null")
    void setUp() {
        openMocks(this);
        service = new SettingsService(repo, events);
        when(repo.save(any(Settings.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void tallyDefaultsForANewYear() {
        when(repo.findByYear(2027)).thenReturn(Optional.empty());
        when(events.countIncrementsByYear(2027)).thenReturn(null);

        SettingsService.Tally tally = service.tally(2027);

        assertEquals(0, tally.total());
        assertEquals(SettingsService.DEFAULT_CANDY, tally.initialCandyCount());
        assertEquals(SettingsService.DEFAULT_CANDY, tally.candyRemaining());
    }

    @Test
    void totalIncludesTheAdjustment() {
        Settings settings = new Settings(2026, 300);
        settings.setCountAdjustment(5);
        when(repo.findByYear(2026)).thenReturn(Optional.of(settings));
        when(events.countIncrementsByYear(2026)).thenReturn(100L);

        SettingsService.Tally tally = service.tally(2026);

        assertEquals(105, tally.total());
        assertEquals(195, tally.candyRemaining());
    }

    @Test
    @SuppressWarnings("null")
    void requestedTotalBecomesAnAdjustment() {
        Settings existing = new Settings(2026, 300);
        when(repo.findByYear(2026)).thenReturn(Optional.of(existing));
        when(events.countIncrementsByYear(2026)).thenReturn(40L);

        SettingsService.Tally tally = service.update(2026, 500, 42);

        assertEquals(2, existing.getCountAdjustment());
        assertEquals(500, existing.getInitialCandyCount());
        assertEquals(42, tally.total());
        verify(repo).save(existing);
    }

    @Test
    @SuppressWarnings("null")
    void updateCreatesTheRowWhenMissing() {
        when(repo.findByYear(2027)).thenReturn(Optional.empty());

        service.update(2027, 400, null);

        verify(repo).save(argThat(s -> s.getYear() == 2027 && s.getInitialCandyCount() == 400
            && s.getCountAdjustment() == 0));
    }
}
