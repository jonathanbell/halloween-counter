package com.halloween.candy_counter.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.halloween.candy_counter.domain.CandyOption;
import com.halloween.candy_counter.repository.SettingsRepository;
import com.halloween.candy_counter.model.Settings;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

import java.util.Collections;
import java.util.List;
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
        service = new SettingsService(repo, new ObjectMapper());
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

    @Test
    @SuppressWarnings("null")
    void candyOptionsKeepIdsAndSlugNewOnes() {
        when(repo.findByYear(2026)).thenReturn(Optional.of(new Settings(2026, 300)));

        List<CandyOption> saved = service.setCandyOptions(2026, List.of(
            new CandyOption("snickers", "Snickers Bar", null),
            new CandyOption(null, "  Snickers ", " "),
            new CandyOption(null, "Kit Kat", "https://example.com/kitkat.png"),
            new CandyOption(null, "🍬", null)
        ));

        assertEquals(List.of("snickers", "snickers-2", "kit-kat", "candy"),
            saved.stream().map(CandyOption::id).toList());
        assertEquals("Snickers", saved.get(1).label());
        assertNull(saved.get(1).imageUrl());
        verify(repo).save(argThat(s -> s.getCandyOptions().contains("kit-kat")));
    }

    @Test
    void candyOptionsRejectBadInput() {
        when(repo.findByYear(2026)).thenReturn(Optional.of(new Settings(2026, 300)));
        CandyOption ok = new CandyOption(null, "Twix", null);

        assertThrows(IllegalArgumentException.class, () ->
            service.setCandyOptions(2026, Collections.nCopies(SettingsService.MAX_CANDY_OPTIONS + 1, ok)));
        assertThrows(IllegalArgumentException.class, () ->
            service.setCandyOptions(2026, List.of(new CandyOption(null, " ", null))));
        assertThrows(IllegalArgumentException.class, () ->
            service.setCandyOptions(2026, List.of(new CandyOption(null, "Twix", "http://x.com/a.png"))));
        assertThrows(IllegalArgumentException.class, () ->
            service.setCandyOptions(2026, List.of(new CandyOption("twix", "A", null), new CandyOption("twix", "B", null))));
        verify(repo, never()).save(any());
    }

    @Test
    void candyOptionsRoundTrip() {
        Settings settings = new Settings(2026, 300);
        settings.setCandyOptions("[{\"id\":\"twix\",\"label\":\"Twix\",\"imageUrl\":null}]");
        when(repo.findByYear(2026)).thenReturn(Optional.of(settings));
        when(repo.findByYear(2027)).thenReturn(Optional.empty());

        assertTrue(service.isCandyOption(2026, "twix"));
        assertFalse(service.isCandyOption(2026, "nope"));
        assertEquals(List.of(), service.getCandyOptions(2027));
    }
}
