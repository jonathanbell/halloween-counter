package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.model.Settings;
import com.halloween.candy_counter.repository.EventRepository;
import com.halloween.candy_counter.service.SettingsService;
import com.halloween.candy_counter.service.SseBroadcaster;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settingsService;
    private final EventRepository eventRepository;
    private final SseBroadcaster sseBroadcaster;

    public SettingsController(SettingsService settingsService,
                              EventRepository eventRepository,
                              SseBroadcaster sseBroadcaster) {
        this.settingsService = settingsService;
        this.eventRepository = eventRepository;
        this.sseBroadcaster = sseBroadcaster;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> get(@RequestParam("year") Integer year) {
        Optional<Settings> settings = settingsService.getSettings(year);
        if (settings.isEmpty()) return ResponseEntity.notFound().build();

        Settings s = settings.get();
        Long eventTotal = eventRepository.countIncrementsByYear(year);
        long total = (eventTotal != null ? eventTotal : 0L) + s.getCountAdjustment();

        Map<String, Object> body = new HashMap<>();
        body.put("year", s.getYear());
        body.put("initialCandyCount", s.getInitialCandyCount());
        body.put("countAdjustment", s.getCountAdjustment());
        body.put("eventTotal", eventTotal);
        body.put("currentTotal", total);
        body.put("candyRemaining", Math.max(0, s.getInitialCandyCount() - total));
        return ResponseEntity.ok(body);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> update(@RequestBody SettingsUpdateRequest request) {
        Integer year = request.year() != null ? request.year() : 2026;
        Settings updated;

        if (request.currentTotal() != null) {
            // Derive the adjustment needed to hit the requested total
            Long eventTotal = eventRepository.countIncrementsByYear(year);
            long actual = eventTotal != null ? eventTotal : 0L;
            int adjustment = (int) (request.currentTotal() - actual);
            updated = settingsService.updateFullSettings(year, request.initialCandyCount(), adjustment);
        } else {
            updated = settingsService.updateFullSettings(year, request.initialCandyCount(), null);
        }

        Long eventTotal = eventRepository.countIncrementsByYear(year);
        long total = (eventTotal != null ? eventTotal : 0L) + updated.getCountAdjustment();

        // Push updated total to all SSE clients immediately
        sseBroadcaster.broadcastCountSnapshot(year);

        Map<String, Object> body = new HashMap<>();
        body.put("year", updated.getYear());
        body.put("initialCandyCount", updated.getInitialCandyCount());
        body.put("countAdjustment", updated.getCountAdjustment());
        body.put("eventTotal", eventTotal);
        body.put("currentTotal", total);
        body.put("candyRemaining", Math.max(0, updated.getInitialCandyCount() - total));
        return ResponseEntity.ok(body);
    }

    public record SettingsUpdateRequest(
        Integer year,
        Integer initialCandyCount,
        Integer currentTotal
    ) {}
}
