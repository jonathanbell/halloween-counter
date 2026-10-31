package com.halloween.candy_counter.domain;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;
import java.util.function.Consumer;

import static com.halloween.candy_counter.domain.GameSchedule.*;
import static org.junit.jupiter.api.Assertions.*;

class GameScheduleTest {

    private static final int SEEDS = 300;

    // The rules must hold for every roll, not one lucky one
    private static void forEverySeed(Consumer<List<Pop>> check) {
        for (long seed = 0; seed < SEEDS; seed++) {
            check.accept(GameSchedule.generate(new Random(seed)).pops());
        }
    }

    @Test
    void hasThirteenZombiesOneGoldenAndThreeDecoys() {
        forEverySeed(pops -> {
            assertEquals(POP_COUNT, pops.size());
            assertEquals(ZOMBIE_COUNT, pops.stream().filter(p -> !p.kind().isDecoy()).count());
            assertEquals(1, pops.stream().filter(p -> p.kind() == Kind.GOLDEN).count());
            assertEquals(DECOY_COUNT, pops.stream().filter(p -> p.kind().isDecoy()).count());
            assertTrue(pops.stream().anyMatch(p -> p.kind() == Kind.GRANDMA), "Grandma brings the candy rain");
        });
    }

    @Test
    void opensWithPlainZombiesBeforeAnyDecoy() {
        forEverySeed(pops -> {
            assertEquals(Kind.ZOMBIE, pops.get(0).kind());
            for (int i = 0; i < DECOY_FREE_POPS; i++) {
                assertFalse(pops.get(i).kind().isDecoy());
            }
        });
    }

    @Test
    void popsAreSpacedAndFinishInsideTheGame() {
        forEverySeed(pops -> {
            assertEquals(FIRST_POP_MS, pops.get(0).atMs());
            for (int i = 1; i < pops.size(); i++) {
                assertTrue(pops.get(i).atMs() - pops.get(i - 1).atMs() >= MIN_GAP_MS);
            }

            Pop last = pops.get(pops.size() - 1);
            assertTrue(last.atMs() + UP_MS <= DURATION_MS, "last pop must be down by the buzzer");
        });
    }

    @Test
    void charactersUpTogetherNeverShareAGrave() {
        forEverySeed(pops -> {
            for (int i = 0; i < pops.size(); i++) {
                Pop pop = pops.get(i);
                assertEquals(i, pop.id());
                assertTrue(pop.grave() >= 0 && pop.grave() < GRAVE_COUNT);
                if (i == 0) continue;

                assertNotEquals(pops.get(i - 1).grave(), pop.grave(), "same grave twice in a row");
                for (int j = 0; j < i; j++) {
                    boolean overlaps = pops.get(j).atMs() + UP_MS > pop.atMs();
                    if (overlaps) assertNotEquals(pops.get(j).grave(), pop.grave());
                }
            }
        });
    }

    @Test
    void sameSeedSameSchedule() {
        assertEquals(
            GameSchedule.generate(new Random(7)).pops(),
            GameSchedule.generate(new Random(7)).pops());
    }

    @Test
    void findRejectsUnknownIds() {
        GameSchedule schedule = GameSchedule.generate(new Random(1));

        assertTrue(schedule.find(0).isPresent());
        assertTrue(schedule.find(-1).isEmpty());
        assertTrue(schedule.find(POP_COUNT).isEmpty());
    }
}
