package com.halloween.candy_counter.service;

import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;

@Service
public class EffectService {

    // Global, not per viewer: mashing is the fun part, but the projector
    // shows one sky. Lightning stays under 3 flashes a second, the WCAG
    // photosensitive-seizure threshold; DroolingRain caps its own emoji
    static final long LIGHTNING_COOLDOWN_MS = 350;
    static final long CANDY_RAIN_COOLDOWN_MS = 250;

    public enum EffectType { LIGHTNING, CANDY_RAIN }

    // GAME_ACTIVE: during a game lightning means "someone bonked a zombie",
    // so viewers cannot fire effects over it
    public enum FireResult { FIRED, COOLDOWN, GAME_ACTIVE }

    private final Map<EffectType, Long> lastFired = new EnumMap<>(EffectType.class);
    private final GameService gameService;

    public EffectService(GameService gameService) {
        this.gameService = gameService;
    }

    // Synchronized: concurrent requests must not both pass the cooldown gate
    public synchronized FireResult tryFire(EffectType type) {
        if (gameService.isGameActive()) return FireResult.GAME_ACTIVE;

        long now = System.currentTimeMillis();
        Long last = lastFired.get(type);
        if (last != null && now - last < cooldownFor(type)) return FireResult.COOLDOWN;
        lastFired.put(type, now);
        return FireResult.FIRED;
    }

    private long cooldownFor(EffectType type) {
        return type == EffectType.LIGHTNING ? LIGHTNING_COOLDOWN_MS : CANDY_RAIN_COOLDOWN_MS;
    }
}
