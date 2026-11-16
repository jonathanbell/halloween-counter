package com.halloween.candy_counter.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SseBroadcasterTest {

    private static final int MESSAGES = 200;

    final FreezeService freezeService = mock(FreezeService.class);
    SseBroadcaster broadcaster;

    @BeforeEach
    void setUp() {
        broadcaster = new SseBroadcaster(mock(SettingsService.class), freezeService, new ObjectMapper());
    }

    // Unlock, expiry, midnight: one message per flip, silence in between
    @Test
    void announcesAFreezeFlipOnce() throws Exception {
        Recorder screen = new Recorder(2);
        broadcaster.subscribeForTest(screen);

        broadcaster.announceFreezeFlip(); // still open: nothing to say

        when(freezeService.isFrozen()).thenReturn(true);
        when(freezeService.opensAt()).thenReturn(Instant.parse("2027-10-31T07:00:00Z"));
        broadcaster.announceFreezeFlip();
        broadcaster.announceFreezeFlip(); // same answer: nothing to say

        // A marker behind the flip: anything extra would land before it
        broadcaster.broadcastGameEvent("game_tap", Map.of("x", 0, "z", 0));

        assertTrue(screen.done.await(5, TimeUnit.SECONDS));
        ObjectMapper json = new ObjectMapper();
        JsonNode flip = json.readTree(screen.received.get(0));
        assertEquals("freeze", flip.get("type").asText());
        assertTrue(flip.get("frozen").asBoolean());
        assertEquals("2027-10-31T07:00:00Z", flip.get("opensAt").asText());
        assertEquals("game_tap", json.readTree(screen.received.get(1)).get("type").asText());
    }

    @AfterEach
    void tearDown() {
        broadcaster.cleanup();
    }

    // A screen sees messages in the order they were sent: a bonk never
    // lands before its pop, a count never steps backwards
    @Test
    void eachScreenReceivesMessagesInOrder() throws Exception {
        Recorder screen = new Recorder(MESSAGES);
        broadcaster.subscribeForTest(screen);

        for (int i = 0; i < MESSAGES; i++) {
            broadcaster.broadcastGameEvent("game_tap", Map.of("x", i, "z", 0));
        }

        assertTrue(screen.done.await(5, TimeUnit.SECONDS));
        ObjectMapper json = new ObjectMapper();
        for (int i = 0; i < MESSAGES; i++) {
            assertEquals(i, json.readTree(screen.received.get(i)).get("x").asInt());
        }
    }

    private static class Recorder extends SseEmitter {
        final List<String> received = new ArrayList<>();
        final CountDownLatch done;

        Recorder(int expected) {
            done = new CountDownLatch(expected);
        }

        @Override
        public void send(Object object) {
            synchronized (received) {
                received.add((String) object);
            }
            done.countDown();
        }
    }
}
