package com.halloween.candy_counter.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.halloween.candy_counter.domain.CandyOption;
import com.halloween.candy_counter.model.Settings;
import com.halloween.candy_counter.repository.SettingsRepository;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class SettingsService {

    static final int MAX_CANDY_OPTIONS = 50;
    // Ids land in events.candy_type, a VARCHAR(50)
    private static final int MAX_ID_LENGTH = 50;
    private static final int MAX_SLUG_LENGTH = 40;
    private static final int MAX_LABEL_LENGTH = 50;
    private static final int MAX_URL_LENGTH = 2048;
    private static final String SLUG_FALLBACK = "candy";
    private static final TypeReference<List<CandyOption>> OPTION_LIST = new TypeReference<>() {};

    private final SettingsRepository settingsRepository;
    private final ObjectMapper objectMapper;

    public SettingsService(SettingsRepository settingsRepository, ObjectMapper objectMapper) {
        this.settingsRepository = settingsRepository;
        this.objectMapper = objectMapper;
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

    // Empty when the year has no settings row or no options saved yet
    public List<CandyOption> getCandyOptions(Integer year) {
        String json = settingsRepository.findByYear(year).map(Settings::getCandyOptions).orElse(null);
        if (json == null) return List.of();

        try {
            return objectMapper.readValue(json, OPTION_LIST);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unreadable candy_options for " + year, e);
        }
    }

    public boolean isCandyOption(Integer year, String id) {
        return getCandyOptions(year).stream().anyMatch(o -> id.equals(o.id()));
    }

    /**
     * Replaces the year's whole list. A row without an id gets a slug of its
     * label ("Kit Kat" -> kit-kat, then kit-kat-2); a row with one keeps it,
     * so its votes survive a rename. Throws IllegalArgumentException with a
     * message the settings page shows as-is.
     */
    @Transactional
    @SuppressWarnings("null")
    public List<CandyOption> setCandyOptions(Integer year, List<CandyOption> options) {
        if (options.size() > MAX_CANDY_OPTIONS) {
            throw new IllegalArgumentException("At most " + MAX_CANDY_OPTIONS + " candies");
        }

        // Reserve every given id first, so a new row cannot slug into one
        Set<String> taken = new HashSet<>();
        options.forEach(o -> { if (o.id() != null) taken.add(o.id()); });

        List<CandyOption> cleaned = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < options.size(); i++) {
            CandyOption option = options.get(i);
            String row = "Row " + (i + 1) + ": ";

            String label = option.label() == null ? "" : option.label().strip();
            if (label.isEmpty() || label.length() > MAX_LABEL_LENGTH) {
                throw new IllegalArgumentException(row + "label must be 1-" + MAX_LABEL_LENGTH + " characters");
            }

            String url = blankToNull(option.imageUrl());
            if (url != null && (!url.startsWith("https://") || url.length() > MAX_URL_LENGTH)) {
                throw new IllegalArgumentException(row + "image URL must start with https://");
            }

            String id = option.id() != null ? option.id() : slug(label, taken);
            if (id.isBlank() || id.length() > MAX_ID_LENGTH || !seen.add(id)) {
                throw new IllegalArgumentException(row + "duplicate or invalid id");
            }
            taken.add(id);
            cleaned.add(new CandyOption(id, label, url));
        }

        Settings settings = settingsRepository.findByYear(year).orElseGet(() -> {
            Settings fresh = new Settings();
            fresh.setYear(year);
            return fresh;
        });
        try {
            settings.setCandyOptions(objectMapper.writeValueAsString(cleaned));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not write candy_options", e);
        }
        settingsRepository.save(settings);
        return cleaned;
    }

    private static String slug(String label, Set<String> taken) {
        String base = label.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (base.length() > MAX_SLUG_LENGTH) base = base.substring(0, MAX_SLUG_LENGTH);
        if (base.isEmpty()) base = SLUG_FALLBACK;

        String id = base;
        for (int n = 2; taken.contains(id); n++) id = base + "-" + n;
        return id;
    }

    @Nullable
    private static String blankToNull(@Nullable String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
