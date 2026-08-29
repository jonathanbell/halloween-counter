package com.halloween.candy_counter.service;

import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;

@Service
public class EffectService {

    private static final long LIGHTNING_COOLDOWN_MS = 7000;
    private static final long CANDY_RAIN_COOLDOWN_MS = 7000;

    public enum EffectType { LIGHTNING, CANDY_RAIN }

    private final Map<EffectType, Long> lastFired = new EnumMap<>(EffectType.class);

    public boolean tryFire(EffectType type) {
        long now = System.currentTimeMillis();
        Long last = lastFired.get(type);
        if (last != null && now - last < cooldownFor(type)) return false;
        lastFired.put(type, now);
        return true;
    }

    private long cooldownFor(EffectType type) {
        return type == EffectType.LIGHTNING ? LIGHTNING_COOLDOWN_MS : CANDY_RAIN_COOLDOWN_MS;
    }
}
