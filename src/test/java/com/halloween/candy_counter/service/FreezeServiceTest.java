package com.halloween.candy_counter.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static com.halloween.candy_counter.service.FreezeService.UnlockResult.SEALED;
import static com.halloween.candy_counter.service.FreezeService.UnlockResult.UNLOCKED;
import static org.junit.jupiter.api.Assertions.*;

class FreezeServiceTest {

    private static final Instant HALLOWEEN_2027 = Instant.parse("2027-10-31T07:00:00Z");

    final TestClock clock = new TestClock();
    FreezeService service;

    @BeforeEach
    void setUp() {
        service = new FreezeService(true, clock);
    }

    @Test
    void openOnlyOnHalloween() {
        pacific("2026-10-30T23:59:59");
        assertTrue(service.isFrozen());

        pacific("2026-10-31T00:00:00");
        assertFalse(service.isFrozen());

        pacific("2026-10-31T23:59:59");
        assertFalse(service.isFrozen());

        pacific("2026-11-01T00:00:00");
        assertTrue(service.isFrozen());
    }

    // The container's clock is UTC, where Halloween evening is already Nov 1
    @Test
    void goesByThePacificDateNotUtc() {
        clock.now = Instant.parse("2026-11-01T03:00:00Z"); // 8pm PDT, Oct 31
        assertFalse(service.isFrozen());

        clock.now = Instant.parse("2026-10-31T03:00:00Z"); // 8pm PDT, Oct 30
        assertTrue(service.isFrozen());
    }

    @Test
    void unlockOpensForTheWindowThenRelocks() {
        pacific("2027-03-01T12:00:00");
        assertEquals(UNLOCKED, service.unlock());
        assertFalse(service.isFrozen());

        pacific("2027-03-01T13:59:59");
        assertFalse(service.isFrozen());

        pacific("2027-03-01T14:00:00");
        assertTrue(service.isFrozen());
    }

    @Test
    void lockEndsAnUnlockEarly() {
        pacific("2027-03-01T12:00:00");
        service.unlock();
        service.lock();

        assertTrue(service.isFrozen());
    }

    // A test write in November would land in the Halloween just counted
    @Test
    void sealedFromNovemberUntilNewYear() {
        pacific("2026-11-13T12:00:00");
        assertEquals(SEALED, service.unlock());
        assertTrue(service.isFrozen());

        pacific("2026-12-31T23:59:59");
        assertEquals(SEALED, service.unlock());

        pacific("2027-01-01T00:00:00");
        assertEquals(UNLOCKED, service.unlock());
        assertFalse(service.isFrozen());
    }

    @Test
    void unlockOnTheNightDoesNotLeakIntoNovember() {
        pacific("2026-10-31T23:30:00");
        assertEquals(UNLOCKED, service.unlock());

        pacific("2026-11-01T00:30:00");
        assertTrue(service.isFrozen());
    }

    @Test
    void requireOpenThrowsOnlyWhileFrozen() {
        pacific("2026-10-31T18:00:00");
        assertDoesNotThrow(service::requireOpen);

        pacific("2026-11-01T18:00:00");
        assertThrows(FrozenException.class, service::requireOpen);
    }

    @Test
    void opensAtIsTheNextHalloweenMidnightPacific() {
        pacific("2026-11-13T12:00:00");
        assertEquals(HALLOWEEN_2027, service.opensAt());

        pacific("2027-03-01T12:00:00");
        assertEquals(HALLOWEEN_2027, service.opensAt());

        // On the night it is that morning's midnight, already past
        pacific("2027-10-31T18:00:00");
        assertEquals(HALLOWEEN_2027, service.opensAt());
    }

    @Test
    void disabledNeverFreezes() {
        service = new FreezeService(false, clock);
        pacific("2026-11-13T12:00:00");

        assertFalse(service.isFrozen());
        assertDoesNotThrow(service::requireOpen);
    }

    // Pacific wall-clock time, e.g. pacific("2026-10-31T00:00:00")
    private void pacific(String local) {
        clock.now = LocalDateTime.parse(local).atZone(FreezeService.ZONE).toInstant();
    }

    // A clock the test moves by hand
    private static class TestClock extends Clock {
        Instant now;

        @Override public Instant instant() { return now; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
    }
}
