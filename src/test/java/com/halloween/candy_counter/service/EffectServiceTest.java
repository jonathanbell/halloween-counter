package com.halloween.candy_counter.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

import static com.halloween.candy_counter.service.EffectService.EffectType.*;
import static com.halloween.candy_counter.service.EffectService.FireResult.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.openMocks;

class EffectServiceTest {

    @Mock GameService gameService;
    @Mock FreezeService freezeService;
    EffectService service;

    @BeforeEach
    void setUp() {
        openMocks(this);
        service = new EffectService(gameService, freezeService);
    }

    @Test
    void refusedWhileFrozenWithoutUsingTheCooldown() {
        doThrow(new FrozenException()).when(freezeService).requireOpen();
        assertThrows(FrozenException.class, () -> service.tryFire(LIGHTNING));

        // Unlocked a moment later: the refused call left no cooldown behind
        doNothing().when(freezeService).requireOpen();
        assertEquals(FIRED, service.tryFire(LIGHTNING));
    }

    @Test
    void firstFireAllowed() {
        assertEquals(FIRED, service.tryFire(LIGHTNING));
    }

    @Test
    void consecutiveFireBlockedWithinCooldown() {
        service.tryFire(LIGHTNING);
        assertEquals(COOLDOWN, service.tryFire(LIGHTNING));
    }

    @Test
    void firesAgainOnceTheCooldownPasses() throws InterruptedException {
        service.tryFire(LIGHTNING);
        Thread.sleep(EffectService.LIGHTNING_COOLDOWN_MS + 50);
        assertEquals(FIRED, service.tryFire(LIGHTNING));
    }

    @Test
    void lightningStaysUnderThreeFlashesASecond() {
        assertTrue(EffectService.LIGHTNING_COOLDOWN_MS > 1000 / 3);
    }

    @Test
    void differentEffectTypesIsolated() {
        service.tryFire(LIGHTNING);
        assertEquals(FIRED, service.tryFire(CANDY_RAIN));
    }

    @Test
    void blockedDuringAGameWithoutUsingTheCooldown() {
        when(gameService.isGameActive()).thenReturn(true);
        assertEquals(GAME_ACTIVE, service.tryFire(LIGHTNING));

        // The refused call must not start a cooldown for after the game
        when(gameService.isGameActive()).thenReturn(false);
        assertEquals(FIRED, service.tryFire(LIGHTNING));
    }
}
