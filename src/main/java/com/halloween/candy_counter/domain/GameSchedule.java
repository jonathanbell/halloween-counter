package com.halloween.candy_counter.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.random.RandomGenerator;

/**
 * One game's worth of pops, generated up front and sent to the phone so it
 * can run the game on its own clock (network lag must not be part of a
 * reaction time).
 *
 * <pre>
 * 0s   0.5s        ≥1s gaps, random              28.5s   30s
 * |----Z----Z----Z----G----Z--*--Z----K----Z ... --|-------|
 *      first 3 pops are never decoys        last pop is down by 30s
 * </pre>
 */
public final class GameSchedule {

    // 3x3 grid; src/game/graves.ts maps each index to a world position
    public static final int GRAVE_COUNT = 9;
    public static final int ZOMBIE_COUNT = 13;
    public static final int DECOY_COUNT = 3;
    public static final int POP_COUNT = ZOMBIE_COUNT + DECOY_COUNT;

    public static final long COUNTDOWN_MS = 3000;
    public static final long DURATION_MS = 30_000;

    // How long a character stays up before it escapes back into its grave
    public static final long UP_MS = 1500;

    static final long FIRST_POP_MS = 500;
    static final long MIN_GAP_MS = 1000;

    // Kids learn what a zombie looks like before the first trick
    static final int DECOY_FREE_POPS = 3;

    public enum Kind {
        ZOMBIE, GOLDEN, GRANDMA, CAT, KEVIN;

        public boolean isDecoy() {
            return this == GRANDMA || this == CAT || this == KEVIN;
        }

        // Lowercase on the wire: "zombie", "grandma", ...
        public String wire() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    public record Pop(int id, long atMs, int grave, Kind kind) {}

    private static final Kind[] DECOYS = { Kind.GRANDMA, Kind.CAT, Kind.KEVIN };

    private final List<Pop> pops;

    private GameSchedule(List<Pop> pops) {
        this.pops = List.copyOf(pops);
    }

    public List<Pop> pops() {
        return pops;
    }

    public Optional<Pop> find(int id) {
        if (id < 0 || id >= pops.size()) return Optional.empty();
        return Optional.of(pops.get(id));
    }

    public static GameSchedule generate(RandomGenerator random) {
        Kind[] kinds = kinds(random);
        long[] times = times(random);

        List<Pop> pops = new ArrayList<>(POP_COUNT);
        for (int i = 0; i < POP_COUNT; i++) {
            int grave = pickGrave(pops, times[i], random);
            pops.add(new Pop(i, times[i], grave, kinds[i]));
        }

        return new GameSchedule(pops);
    }

    // Which character pops at each slot: decoys after the first three slots,
    // at least one Grandma (she brings the candy rain), one golden zombie
    private static Kind[] kinds(RandomGenerator random) {
        Kind[] kinds = new Kind[POP_COUNT];
        java.util.Arrays.fill(kinds, Kind.ZOMBIE);

        List<Integer> slots = new ArrayList<>();
        for (int i = DECOY_FREE_POPS; i < POP_COUNT; i++) slots.add(i);
        Collections.shuffle(slots, asRandom(random));

        List<Kind> decoys = new ArrayList<>();
        decoys.add(Kind.GRANDMA);
        while (decoys.size() < DECOY_COUNT) {
            decoys.add(DECOYS[random.nextInt(DECOYS.length)]);
        }
        for (int i = 0; i < DECOY_COUNT; i++) {
            kinds[slots.get(i)] = decoys.get(i);
        }

        // Golden anywhere but the very first pop, which is always plain
        int golden;
        do {
            golden = 1 + random.nextInt(POP_COUNT - 1);
        } while (kinds[golden] != Kind.ZOMBIE);
        kinds[golden] = Kind.GOLDEN;

        return kinds;
    }

    // Pop start times: FIRST_POP_MS, then MIN_GAP_MS plus a random share of
    // the leftover time per gap. One extra share is left unused at the end,
    // so the last pop does not always land on the final moment
    private static long[] times(RandomGenerator random) {
        long lastStart = DURATION_MS - UP_MS;
        long slack = lastStart - FIRST_POP_MS - (POP_COUNT - 1) * MIN_GAP_MS;

        double[] weights = new double[POP_COUNT];
        double total = 0;
        for (int i = 0; i < POP_COUNT; i++) {
            weights[i] = random.nextDouble();
            total += weights[i];
        }

        long[] times = new long[POP_COUNT];
        times[0] = FIRST_POP_MS;
        for (int i = 1; i < POP_COUNT; i++) {
            long extra = (long) Math.floor(slack * weights[i - 1] / total);
            times[i] = times[i - 1] + MIN_GAP_MS + extra;
        }
        return times;
    }

    // Never the grave a character is still standing in, and never the same
    // grave twice in a row
    private static int pickGrave(List<Pop> earlier, long atMs, RandomGenerator random) {
        Set<Integer> taken = new HashSet<>();
        for (Pop pop : earlier) {
            if (pop.atMs() + UP_MS > atMs) taken.add(pop.grave());
        }
        if (!earlier.isEmpty()) taken.add(earlier.get(earlier.size() - 1).grave());

        List<Integer> free = new ArrayList<>();
        for (int g = 0; g < GRAVE_COUNT; g++) {
            if (!taken.contains(g)) free.add(g);
        }
        return free.get(random.nextInt(free.size()));
    }

    // Collections.shuffle wants a java.util.Random
    private static java.util.Random asRandom(RandomGenerator random) {
        return random instanceof java.util.Random r ? r : new java.util.Random(random.nextLong());
    }
}
