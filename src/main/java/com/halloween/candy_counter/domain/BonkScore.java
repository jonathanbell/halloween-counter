package com.halloween.candy_counter.domain;

/**
 * Points for one bonk. The server is the only place this formula lives; the
 * phone shows the reaction time instantly and the points when the server's
 * score_update arrives.
 *
 * <pre>
 * points
 * 1000 |*                 every real bonk earns at least 100,
 *      |   *              so a slow five-year-old still scores
 *  550 |       *
 *      |           *
 *  100 |_______________*  golden zombie: x2   decoy: -500
 *      0ms           1500ms (UP_MS, then it escapes)
 * </pre>
 */
public final class BonkScore {

    static final int BASE_POINTS = 100;
    static final int MAX_SPEED_BONUS = 900;
    static final int GOLDEN_MULTIPLIER = 2;
    static final int DECOY_PENALTY = -500;

    // Faster than any human reaction: a mashed or scripted tap
    static final long MIN_HUMAN_MS = 100;

    public enum Verdict {
        BONK, TOO_FAST, ESCAPED, DECOY;

        public String wire() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }
    }

    public record Result(Verdict verdict, int points) {}

    private BonkScore() {}

    public static Result judge(GameSchedule.Kind kind, long ms) {
        if (ms > GameSchedule.UP_MS) return new Result(Verdict.ESCAPED, 0);
        if (kind.isDecoy()) return new Result(Verdict.DECOY, DECOY_PENALTY);
        if (ms < MIN_HUMAN_MS) return new Result(Verdict.TOO_FAST, 0);

        long remaining = GameSchedule.UP_MS - ms;
        int bonus = (int) Math.round((double) MAX_SPEED_BONUS * remaining / GameSchedule.UP_MS);
        int points = BASE_POINTS + bonus;

        if (kind == GameSchedule.Kind.GOLDEN) points *= GOLDEN_MULTIPLIER;
        return new Result(Verdict.BONK, points);
    }
}
