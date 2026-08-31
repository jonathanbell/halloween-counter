package com.halloween.candy_counter.service;

import com.halloween.candy_counter.model.Settings;
import com.halloween.candy_counter.repository.SettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class SettingsService {

    private final SettingsRepository settingsRepository;

    public SettingsService(SettingsRepository settingsRepository) {
        this.settingsRepository = settingsRepository;
    }

    public Optional<Settings> getSettings(Integer year) {
        return settingsRepository.findByYear(year);
    }

    @Transactional
    public Settings updateSettings(Integer year, Integer initialCandyCount) {
        Optional<Settings> existing = settingsRepository.findByYear(year);
        Settings settings = existing.orElse(new Settings(year, initialCandyCount));
        settings.setInitialCandyCount(initialCandyCount);
        return settingsRepository.save(settings);
    }

    @Transactional
    @SuppressWarnings("null")
    public Settings updateFullSettings(Integer year, Integer initialCandyCount, Integer countAdjustment) {
        Optional<Settings> existing = settingsRepository.findByYear(year);
        Settings settings = existing.orElse(new Settings(year, initialCandyCount != null ? initialCandyCount : 300));
        if (initialCandyCount != null) settings.setInitialCandyCount(initialCandyCount);
        if (countAdjustment != null) settings.setCountAdjustment(countAdjustment);
        return settingsRepository.save(settings);
    }
}
