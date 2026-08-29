package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.repository.EventRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final EventRepository eventRepository;

    public StatsController(EventRepository eventRepository) {
        this.eventRepository = eventRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getStats(@RequestParam(defaultValue = "2026") Integer year) {
        Map<String, Object> stats = new HashMap<>();

        // Total increments
        Long total = eventRepository.sumIncrementsByYear(year);
        stats.put("total", total != null ? total : 0);

        // Vote counts by candy type
        Map<String, Long> votes = new HashMap<>();
        votes.put("snickers", eventRepository.countVotesByYearAndCandyType(year, "snickers"));
        votes.put("m&ms", eventRepository.countVotesByYearAndCandyType(year, "m&ms"));
        votes.put("twix", eventRepository.countVotesByYearAndCandyType(year, "twix"));
        stats.put("votes", votes);

        // Minute-by-minute histogram (last 60 minutes)
        stats.put("histogram", buildHistogram(year));

        return ResponseEntity.ok(stats);
    }

    private List<Map<String, Object>> buildHistogram(Integer year) {
        // Get all events for the year
        var events = eventRepository.findEventsByYear(year);

        // Group by minute (UTC)
        Map<Instant, Long> minuteCounts = new HashMap<>();
        for (var event : events) {
            Instant minute = event.getTimestamp().truncatedTo(ChronoUnit.MINUTES);
            minuteCounts.merge(minute, 1L, Long::sum);
        }

        // Convert to sorted list
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
