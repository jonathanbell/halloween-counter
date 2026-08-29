package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.service.CounterService;
import com.halloween.candy_counter.service.EffectService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/effects")
public class EffectsController {

    private final CounterService counterService;
    private final EffectService effectService;

    public EffectsController(CounterService counterService, EffectService effectService) {
        this.counterService = counterService;
        this.effectService = effectService;
    }

    @PostMapping("/lightning")
    public ResponseEntity<?> lightning(@RequestParam(defaultValue = "2026") Integer year) {
        return handleEffect(EffectService.EffectType.LIGHTNING, year);
    }

    @PostMapping("/candy-rain")
    public ResponseEntity<?> candyRain(@RequestParam(defaultValue = "2026") Integer year) {
        return handleEffect(EffectService.EffectType.CANDY_RAIN, year);
    }

    private ResponseEntity<?> handleEffect(EffectService.EffectType type, Integer year) {
        if (!effectService.tryFire(type)) {
            Map<String, String> body = Map.of("error", "effect_cooldown");
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(body);
        }

        Event event = type == EffectService.EffectType.LIGHTNING
            ? counterService.effectLightning(year)
            : counterService.effectCandyRain(year);

        return ResponseEntity.ok(event);
    }
}
