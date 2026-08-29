package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.service.CounterService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/effects")
public class EffectsController {

    private final CounterService counterService;

    public EffectsController(CounterService counterService) {
        this.counterService = counterService;
    }

    @PostMapping("/lightning")
    public ResponseEntity<Event> lightning(@RequestParam(defaultValue = "2026") Integer year) {
        Event event = counterService.effectLightning(year);
        return ResponseEntity.ok(event);
    }

    @PostMapping("/candy-rain")
    public ResponseEntity<Event> candyRain(@RequestParam(defaultValue = "2026") Integer year) {
        Event event = counterService.effectCandyRain(year);
        return ResponseEntity.ok(event);
    }
}
