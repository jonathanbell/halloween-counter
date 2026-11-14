package com.halloween.candy_counter.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class SseBroadcasterTest {

    private static final int MESSAGES = 200;

    SseBroadcaster broadcaster;

    @BeforeEach
    void setUp() {
        broadcaster = new SseBroadcaster(mock(SettingsService.class), new ObjectMapper());
    }

    @AfterEach
    void tearDown() {
        broadcaster.cleanup();
    }

    // A screen sees messages in the order they were sent: a bonk never
    // lands before its pop, a count never steps backwards
    @Test
    void eachScreenReceivesMessagesInOrder() throws Exception {
        Recorder screen = new Recorder();
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
        final CountDownLatch done = new CountDownLatch(MESSAGES);

        @Override
        public void send(Object object) {
            synchronized (received) {
                received.add((String) object);
            }
            done.countDown();
        }
    }
}
