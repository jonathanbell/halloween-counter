package com.halloween.candy_counter.service;

import com.halloween.candy_counter.model.Settings;
import com.halloween.candy_counter.repository.EventRepository;
import com.halloween.candy_counter.repository.SettingsRepository;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    // Supply for a year nobody has configured yet
    static final int DEFAULT_CANDY = 300;

    private final SettingsRepository settingsRepository;
    private final EventRepository eventRepository;

    public SettingsService(SettingsRepository settingsRepository, EventRepository eventRepository) {
        this.settingsRepository = settingsRepository;
        this.eventRepository = eventRepository;
    }

    // One year's numbers. total = increment events + count_adjustment is
    // computed here and nowhere else
    public record Tally(int year, long eventTotal, int countAdjustment, int initialCandyCount) {
        public long total() {
            return eventTotal + countAdjustment;
        }

        public long candyRemaining() {
            return Math.max(0, initialCandyCount - total());
        }
    }

    // A year without a settings row (e.g. the first visit of a new year)
    // reads as the default supply and no adjustment
    public Tally tally(Integer year) {
        Settings settings = forYear(year);
        return new Tally(year, increments(year), settings.getCountAdjustment(), settings.getInitialCandyCount());
    }

    // A requested total is stored as an adjustment on top of the real events,
    // so a correction never deletes history: 42 wanted, 40 counted -> +2
    @Transactional
    public Tally update(Integer year, @Nullable Integer initialCandyCount, @Nullable Integer currentTotal) {
        Settings settings = forYear(year);
        if (initialCandyCount != null) settings.setInitialCandyCount(initialCandyCount);
        if (currentTotal != null) settings.setCountAdjustment((int) (currentTotal - increments(year)));
        settingsRepository.save(settings);
        return tally(year);
    }

    private Settings forYear(Integer year) {
        return settingsRepository.findByYear(year).orElseGet(() -> new Settings(year, DEFAULT_CANDY));
    }

    private long increments(Integer year) {
        Long count = eventRepository.countIncrementsByYear(year);
        return count != null ? count : 0L;
    }
}
