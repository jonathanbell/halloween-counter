package com.halloween.candy_counter.domain;

import org.junit.jupiter.api.Test;

import static com.halloween.candy_counter.domain.BonkScore.*;
import static org.junit.jupiter.api.Assertions.*;

class BonkScoreTest {

    @Test
    void fasterBonksScoreMore() {
        Result fast = judge(GameSchedule.Kind.ZOMBIE, 300);
        Result slow = judge(GameSchedule.Kind.ZOMBIE, 1200);

        assertEquals(Verdict.BONK, fast.verdict());
        assertEquals(820, fast.points()); // 100 + 900 * 1200/1500
        assertEquals(280, slow.points()); // 100 + 900 * 300/1500
    }

    @Test
    void slowestRealBonkStillScoresTheBase() {
        assertEquals(BASE_POINTS, judge(GameSchedule.Kind.ZOMBIE, GameSchedule.UP_MS).points());
    }

    @Test
    void goldenZombieDoubles() {
        assertEquals(1640, judge(GameSchedule.Kind.GOLDEN, 300).points());
    }

    @Test
    void decoysCostPointsAtAnySpeed() {
        for (GameSchedule.Kind decoy : new GameSchedule.Kind[] {
                GameSchedule.Kind.GRANDMA, GameSchedule.Kind.CAT, GameSchedule.Kind.KEVIN }) {
            assertEquals(new Result(Verdict.DECOY, DECOY_PENALTY), judge(decoy, 400));
            assertEquals(new Result(Verdict.DECOY, DECOY_PENALTY), judge(decoy, 20));
        }
    }

    @Test
    void inhumanlyFastTapsScoreNothing() {
        assertEquals(new Result(Verdict.TOO_FAST, 0), judge(GameSchedule.Kind.ZOMBIE, MIN_HUMAN_MS - 1));
        assertEquals(new Result(Verdict.TOO_FAST, 0), judge(GameSchedule.Kind.ZOMBIE, -50));
        assertEquals(Verdict.BONK, judge(GameSchedule.Kind.ZOMBIE, MIN_HUMAN_MS).verdict());
    }

    @Test
    void afterUpTimeTheCharacterHasEscaped() {
        assertEquals(new Result(Verdict.ESCAPED, 0), judge(GameSchedule.Kind.ZOMBIE, GameSchedule.UP_MS + 1));
        assertEquals(new Result(Verdict.ESCAPED, 0), judge(GameSchedule.Kind.GRANDMA, GameSchedule.UP_MS + 1));
    }
}
