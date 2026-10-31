package com.halloween.candy_counter.domain;

import org.springframework.lang.Nullable;

import java.util.Locale;
import java.util.Set;

/**
 * Arcade initials: up to three letters A-Z. Anything blank or rude becomes
 * BOO, which the player sees on the garage door instead of what they typed.
 */
public final class Initials {

    static final int MAX_LENGTH = 3;
    static final String FALLBACK = "BOO";

    // Kids will try. Matched after cleanup, so "a.s.s" is caught too
    private static final Set<String> BLOCKED = Set.of(
        "FU", "ASS", "CUM", "DIC", "DIK", "DIX", "FAG", "FCK", "FUC", "FUK",
        "FUX", "JIZ", "KKK", "KUM", "NIG", "NGR", "PIS", "SEX", "SHT", "TIT",
        "VAG", "WTF", "XXX", "COC", "COK", "POS", "STD", "FKU", "FKN", "HOE"
    );

    private Initials() {}

    public static String sanitize(@Nullable String raw) {
        if (raw == null) return FALLBACK;

        String letters = raw.toUpperCase(Locale.ROOT).replaceAll("[^A-Z]", "");
        if (letters.length() > MAX_LENGTH) letters = letters.substring(0, MAX_LENGTH);

        if (letters.isEmpty() || BLOCKED.contains(letters)) return FALLBACK;
        return letters;
    }
}
