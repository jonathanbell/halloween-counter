package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.service.CounterService;
import com.halloween.candy_counter.service.SettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final CounterService counterService;
    private final SettingsService settingsService;

    public StatsController(CounterService counterService, SettingsService settingsService) {
        this.counterService = counterService;
        this.settingsService = settingsService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getStats(@RequestParam Integer year) {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", settingsService.tally(year).total());
        stats.put("histogram", counterService.histogram(year));

        return ResponseEntity.ok(stats);
    }
}
