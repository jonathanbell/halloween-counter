package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.repository.EventRepository;
import com.halloween.candy_counter.repository.SettingsRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final EventRepository eventRepository;
    private final SettingsRepository settingsRepository;

    public StatsController(EventRepository eventRepository,
                           SettingsRepository settingsRepository) {
        this.eventRepository = eventRepository;
        this.settingsRepository = settingsRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getStats(@RequestParam(defaultValue = "2026") Integer year) {
        Map<String, Object> stats = new HashMap<>();

        Long eventTotal = eventRepository.countIncrementsByYear(year);
        int adjustment = settingsRepository.findByYear(year)
            .map(s -> s.getCountAdjustment() != null ? s.getCountAdjustment() : 0)
            .orElse(0);
        long total = (eventTotal != null ? eventTotal : 0L) + adjustment;
        stats.put("total", total);

        Map<String, Long> votes = new HashMap<>();
        for (Object[] row : eventRepository.countVotesByYear(year)) {
            votes.put((String) row[0], (Long) row[1]);
        }
        stats.put("votes", votes);

        List<Map<String, Object>> gameScores = eventRepository.findGameScoresByYear(year)
            .stream()
            .map(e -> {
                Map<String, Object> score = new HashMap<>();
                score.put("score", e.getScore());
                score.put("timestamp", e.getTimestamp().toString());
                return score;
            })
            .toList();
        stats.put("gameScores", gameScores);

        stats.put("histogram", buildHistogram(year));

        return ResponseEntity.ok(stats);
    }

    private List<Map<String, Object>> buildHistogram(Integer year) {
        List<Event> events = eventRepository.findIncrementsByYear(year);

        Map<Instant, Long> minuteCounts = new HashMap<>();
        for (Event event : events) {
            Instant minute = event.getTimestamp().truncatedTo(ChronoUnit.MINUTES);
            minuteCounts.merge(minute, 1L, Long::sum);
        }

        return minuteCounts.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> {
                Map<String, Object> point = new HashMap<>();
                point.put("minute", entry.getKey().toString());
                point.put("count", entry.getValue());
                return point;
            })
            .toList();
    }
}
