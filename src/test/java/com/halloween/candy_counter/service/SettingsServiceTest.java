package com.halloween.candy_counter.service;

import com.halloween.candy_counter.repository.SettingsRepository;
import com.halloween.candy_counter.model.Settings;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.openMocks;

class SettingsServiceTest {

    @Mock SettingsRepository repo;
    SettingsService service;

    @BeforeEach
    void setUp() {
        openMocks(this);
        service = new SettingsService(repo);
    }

    @Test
    @SuppressWarnings("null")
    void updateCreatesNewSettingsWhenMissing() {
        when(repo.findByYear(2026)).thenReturn(Optional.empty());
        when(repo.save(any(Settings.class))).thenAnswer(inv -> inv.getArgument(0));

        Settings result = service.updateSettings(2026, 400);

        assertEquals(2026, result.getYear());
        assertEquals(400, result.getInitialCandyCount());
        verify(repo).save(any(Settings.class));
    }

    @Test
    @SuppressWarnings("null")
    void fullUpdateSetsAdjustment() {
        Settings existing = new Settings(2026, 300);
        when(repo.findByYear(2026)).thenReturn(Optional.of(existing));
        when(repo.save(any(Settings.class))).thenAnswer(inv -> inv.getArgument(0));

        Settings result = service.updateFullSettings(2026, 500, 42);

        assertEquals(500, result.getInitialCandyCount());
        assertEquals(42, result.getCountAdjustment());
    }
}
