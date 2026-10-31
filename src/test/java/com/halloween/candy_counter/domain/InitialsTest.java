package com.halloween.candy_counter.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class InitialsTest {

    @Test
    void uppercasesAndKeepsLettersOnly() {
        assertEquals("JB", Initials.sanitize("j.b!"));
        assertEquals("ABC", Initials.sanitize(" a b c "));
    }

    @Test
    void truncatesToThree() {
        assertEquals("ABC", Initials.sanitize("abcd"));
    }

    @Test
    void blankBecomesBoo() {
        assertEquals(Initials.FALLBACK, Initials.sanitize(null));
        assertEquals(Initials.FALLBACK, Initials.sanitize(""));
        assertEquals(Initials.FALLBACK, Initials.sanitize("123"));
    }

    @Test
    void rudeBecomesBoo() {
        assertEquals(Initials.FALLBACK, Initials.sanitize("ass"));
        assertEquals(Initials.FALLBACK, Initials.sanitize("a.s.s"));
        assertEquals(Initials.FALLBACK, Initials.sanitize("FU"));
    }
}
