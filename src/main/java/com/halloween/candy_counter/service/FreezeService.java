package com.halloween.candy_counter.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Month;
import java.time.MonthDay;
import java.time.ZoneId;

/**
 * The year's data is read-only outside Halloween night (Pacific time).
 *
 * <pre>
 *   Jan 1 ............ Oct 30 | Oct 31 | Nov 1 ........ Dec 31
 *   frozen, can be unlocked   |  open  | frozen, sealed
 * </pre>
 *
 * Sealed: the calendar year is still the Halloween just counted, so a test
 * write would land in real data. From Jan 1 it lands in the coming year,
 * which `make reset-year` wipes before the night.
 */
@Service
public class FreezeService {

    // Oct 31 is always PDT here: the clocks go back in November
    static final ZoneId ZONE = ZoneId.of("America/Vancouver");
    static final MonthDay HALLOWEEN = MonthDay.of(Month.OCTOBER, 31);
    static final Duration UNLOCK_WINDOW = Duration.ofHours(2);

    public enum UnlockResult { UNLOCKED, SEALED }

    private final boolean enabled;
    private final Clock clock;

    // In memory on purpose: a forgotten unlock or a restart re-locks itself
    private volatile Instant unlockedUntil = Instant.MIN;

    @Autowired
    public FreezeService(@Value("${freeze.enabled:true}") boolean enabled) {
        this(enabled, Clock.systemUTC());
    }

    // Tests pass a clock they can move
    FreezeService(boolean enabled, Clock clock) {
        this.enabled = enabled;
        this.clock = clock;
    }

    public boolean isFrozen() {
        if (!enabled) return false;

        LocalDate today = today();
        if (today.equals(halloween(today))) return false;

        // Checked before the unlock: one granted at 23:30 on the night must
        // not carry into Nov 1
        if (isSealed(today)) return true;

        return !clock.instant().isBefore(unlockedUntil);
    }

    // Every write path calls this first
    public void requireOpen() {
        if (isFrozen()) throw new FrozenException();
    }

    public UnlockResult unlock() {
        if (isSealed(today())) return UnlockResult.SEALED;

        unlockedUntil = clock.instant().plus(UNLOCK_WINDOW);
        return UnlockResult.UNLOCKED;
    }

    public void lock() {
        unlockedUntil = Instant.MIN;
    }

    public Instant unlockedUntil() {
        return unlockedUntil;
    }

    // Midnight Pacific that starts the next Halloween (today's, on the night),
    // e.g. 2027-10-31T07:00:00Z from Nov 1 2026 onwards
    public Instant opensAt() {
        LocalDate today = today();
        LocalDate next = isSealed(today) ? halloween(today).plusYears(1) : halloween(today);
        return next.atStartOfDay(ZONE).toInstant();
    }

    private LocalDate today() {
        return clock.instant().atZone(ZONE).toLocalDate();
    }

    private static LocalDate halloween(LocalDate today) {
        return HALLOWEEN.atYear(today.getYear());
    }

    private static boolean isSealed(LocalDate today) {
        return today.isAfter(halloween(today));
    }
}
