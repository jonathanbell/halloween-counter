package com.halloween.candy_counter.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EffectServiceTest {

    EffectService service;

    @BeforeEach
    void setUp() {
        service = new EffectService();
    }

    @Test
    void firstFireAllowed() {
        assertTrue(service.tryFire(EffectService.EffectType.LIGHTNING));
    }

    @Test
    void consecutiveFireBlockedWithinCooldown() {
        service.tryFire(EffectService.EffectType.LIGHTNING);
        assertFalse(service.tryFire(EffectService.EffectType.LIGHTNING));
    }

    @Test
    void differentEffectTypesIsolated() {
        service.tryFire(EffectService.EffectType.LIGHTNING);
        assertTrue(service.tryFire(EffectService.EffectType.CANDY_RAIN));
    }
}
