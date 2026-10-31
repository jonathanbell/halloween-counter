package com.halloween.candy_counter.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.halloween.candy_counter.domain.GameSchedule;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.openMocks;

class GameServiceTest {

    @Mock SseBroadcaster broadcaster;
    @Mock LeaderboardService leaderboard;
    @Mock WebSocketSession session;

    final ObjectMapper objectMapper = new ObjectMapper();
    GameService service;

    @BeforeEach
    void setUp() {
        openMocks(this);
        when(session.getId()).thenReturn("sess-1");
        when(session.isOpen()).thenReturn(true);
        service = new GameService(broadcaster, leaderboard, objectMapper, new Random(42));
    }

    // The service owns an executor; every test that starts a game must not
    // leave its end timer running
    @AfterEach
    void tearDown() {
        service.shutdown();
    }

    @Test
    void startSendsTheScheduleAndAnnouncesThePlayer() throws Exception {
        UUID sessionId = service.startGame(session, "jb");

        assertNotNull(sessionId);
        JsonNode started = sent("game_started").get(0);
        assertEquals("JB", started.get("initials").asText());
        assertEquals(GameSchedule.POP_COUNT, started.get("pops").size());
        assertEquals(GameSchedule.COUNTDOWN_MS, started.get("countdownMs").asLong());
        assertEquals(GameSchedule.DURATION_MS, started.get("durationMs").asLong());
        assertEquals(GameSchedule.UP_MS, started.get("upMs").asLong());

        verify(broadcaster).broadcastGameStatus(argThat(e ->
            e.isActive() && "JB".equals(e.getInitials()) && e.getEndsInMs() > 0));
    }

    @Test
    void secondStartDenied() {
        assertNotNull(service.startGame(session, "AAA"));
        assertNull(service.startGame(session, "BBB")); // one concurrent game gate
    }

    @Test
    void rudeInitialsBecomeBoo() throws Exception {
        service.startGame(session, "ass");

        assertEquals("BOO", sent("game_started").get(0).get("initials").asText());
        assertEquals("BOO", service.activeInitials());
    }

    @Test
    void reportsTimeLeftWhileActive() {
        assertEquals(0, service.endsInMs());

        service.startGame(session, "JB");

        long left = service.endsInMs();
        assertTrue(left > GameSchedule.DURATION_MS && left <= GameSchedule.COUNTDOWN_MS + GameSchedule.DURATION_MS);
    }

    @Test
    void shownPopIsRelayedOnce() {
        service.startGame(session, "JB");

        service.onShown(session, 0);
        service.onShown(session, 0);

        verify(broadcaster, times(1)).broadcastGameEvent(eq("game_pop"), argThat(m -> m.get("id").equals(0)));
    }

    @Test
    void bonkScoresAndRelays() throws Exception {
        service.startGame(session, "JB");
        service.onShown(session, 0); // pop 0 is always a plain zombie

        service.onBonk(session, 0, 300);

        JsonNode update = sent("score_update").get(0);
        assertEquals("bonk", update.get("verdict").asText());
        assertEquals(820, update.get("points").asInt());
        assertEquals(820, update.get("score").asInt());
        verify(broadcaster).broadcastGameEvent(eq("game_bonk"), argThat(m ->
            m.get("ms").equals(300L) && m.get("score").equals(820) && "zombie".equals(m.get("kind"))));
    }

    @Test
    void bonkOnAPopNeverShownIsIgnored() throws Exception {
        service.startGame(session, "JB");

        service.onBonk(session, 0, 300);

        assertTrue(sent("score_update").isEmpty());
        assertEquals(0, game().score.get());
    }

    @Test
    void secondBonkOnTheSamePopIsIgnored() throws Exception {
        service.startGame(session, "JB");
        service.onShown(session, 0);

        service.onBonk(session, 0, 300);
        service.onBonk(session, 0, 300);

        assertEquals(1, sent("score_update").size());
        assertEquals(820, game().score.get());
    }

    @Test
    void unknownPopIdIsIgnored() throws Exception {
        service.startGame(session, "JB");

        service.onShown(session, 999);
        service.onBonk(session, 999, 300);

        assertTrue(sent("score_update").isEmpty());
        verify(broadcaster, never()).broadcastGameEvent(eq("game_pop"), any());
    }

    @Test
    void tooFastTapScoresNothingButUsesUpThePop() throws Exception {
        service.startGame(session, "JB");
        service.onShown(session, 0);

        service.onBonk(session, 0, 20);
        service.onBonk(session, 0, 300);

        List<JsonNode> updates = sent("score_update");
        assertEquals(1, updates.size());
        assertEquals("too_fast", updates.get(0).get("verdict").asText());
        assertEquals(0, game().score.get());
    }

    @Test
    void decoyCostsPointsButTheTotalNeverGoesNegative() throws Exception {
        service.startGame(session, "JB");
        int decoyId = firstDecoyId();
        service.onShown(session, decoyId);

        service.onBonk(session, decoyId, 400);

        JsonNode update = sent("score_update").get(0);
        assertEquals("decoy", update.get("verdict").asText());
        assertEquals(-500, update.get("points").asInt());
        assertEquals(0, update.get("score").asInt());
    }

    @Test
    void decoyComesOffAnEarnedScore() {
        service.startGame(session, "JB");
        int decoyId = firstDecoyId();
        service.onShown(session, 0);
        service.onShown(session, decoyId);

        service.onBonk(session, 0, 300);
        service.onBonk(session, decoyId, 400);

        assertEquals(320, game().score.get());
    }

    @Test
    void tapsAreThrottledAndJunkIsDropped() {
        service.startGame(session, "JB");

        service.onTap(session, 1.5, -2.0);
        service.onTap(session, 1.6, -2.1); // inside the throttle window
        service.onTap(session, Double.NaN, 0);
        service.onTap(session, 500, 0);

        verify(broadcaster, times(1)).broadcastGameEvent(eq("game_tap"), any());
    }

    @Test
    void endPersistsInitialsAndAverageThenReportsRank() throws Exception {
        UUID sessionId = service.startGame(session, "JB");
        service.onShown(session, 0);
        service.onBonk(session, 0, 300);
        when(leaderboard.record(anyInt(), eq(sessionId), eq(820), eq("JB"), eq(300)))
            .thenReturn(new LeaderboardService.Placement(42L, 3));

        service.endGame(session);

        JsonNode ended = sent("game_ended").get(0);
        assertEquals(820, ended.get("score").asInt());
        assertEquals(300, ended.get("avgMs").asInt());
        assertEquals(3, ended.get("rank").asInt());
        assertEquals(42, ended.get("scoreId").asLong());
        verify(broadcaster).broadcastGameStatus(argThat(e -> !e.isActive()));
        verify(broadcaster).broadcastGameEvent(eq("game_result"), argThat(m ->
            "JB".equals(m.get("initials")) && Integer.valueOf(3).equals(m.get("rank"))));
        assertFalse(service.isGameActive());
    }

    @Test
    void gameWhereNothingPoppedIsNotPersisted() throws Exception {
        service.startGame(session, "JB");

        service.endGame(session);

        verifyNoInteractions(leaderboard);
        assertTrue(sent("game_ended").get(0).get("rank").isNull());
    }

    @Test
    void endGameCancelsTheEndTimer() {
        service.startGame(session, "JB");
        var endTask = game().endTask;
        assertNotNull(endTask);

        service.endGame(session);

        // A stale timer would end the next game started on this connection
        assertTrue(endTask.isCancelled());
    }

    @Test
    void disconnectEndsTheGame() {
        service.startGame(session, "JB");

        service.handleDisconnect(session);

        assertFalse(service.isGameActive());
        assertNull(service.activeInitials());
    }

    @Test
    void quitEndsTheGameAndKeepsTheScore() throws Exception {
        UUID sessionId = service.startGame(session, "JB");
        service.onShown(session, 0);
        service.onBonk(session, 0, 300);

        service.quitGame(session);

        assertFalse(service.isGameActive());
        assertEquals(820, sent("game_ended").get(0).get("score").asInt());
        verify(leaderboard).record(anyInt(), eq(sessionId), eq(820), eq("JB"), eq(300));
    }

    private GameService.GameSession game() {
        return service.sessionForTest(session.getId());
    }

    private int firstDecoyId() {
        return game().schedule.pops().stream()
            .filter(p -> p.kind().isDecoy())
            .findFirst()
            .orElseThrow()
            .id();
    }

    // Every WS frame the service sent to the phone, filtered by type
    private List<JsonNode> sent(String type) throws Exception {
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session, atLeast(0)).sendMessage(captor.capture());

        List<JsonNode> matches = new ArrayList<>();
        for (TextMessage msg : captor.getAllValues()) {
            JsonNode node = objectMapper.readTree(msg.getPayload());
            if (type.equals(node.get("type").asText())) matches.add(node);
        }
        return matches;
    }
}
