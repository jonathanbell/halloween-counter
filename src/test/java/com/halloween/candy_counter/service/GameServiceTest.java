package com.halloween.candy_counter.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.web.socket.WebSocketSession;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GameServiceTest {

    @Mock SseBroadcaster broadcaster;
    @Mock WebSocketSession session;
    GameService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(session.getId()).thenReturn("sess-1");
        service = new GameService(broadcaster);
    }

    @Test
    void startGameCreatesSession() {
        UUID result = service.startGame(session);
        assertNotNull(result);
    }

    @Test
    void secondStartGameDenied() {
        UUID first = service.startGame(session);
        assertNotNull(first);
        UUID second = service.startGame(session);
        assertNull(second); // one concurrent game gate
    }

    @Test
    void hitActiveZombieScoresPlusOne() {
        UUID sessionId = service.startGame(session);
        assertNotNull(sessionId);

        // manually inject a spawn
        var gameSession = getSession(service, session.getId());
        long zombieId = 123456L;
        gameSession.getZombieSpawns().put(zombieId,
            new GameService.ZombieSpawn(zombieId, 0, System.currentTimeMillis()));

        service.processZombieHit(session, String.valueOf(zombieId));

        assertEquals(GameService.HIT_SCORE, gameSession.getScore());
    }

    @Test
    void hitExpiredZombieScoresMinusOne() {
        service.startGame(session);
        var gameSession = getSession(service, session.getId());
        long zombieId = 987654L;
        gameSession.getZombieSpawns().put(zombieId,
            new GameService.ZombieSpawn(zombieId, 1,
                System.currentTimeMillis() - (GameService.ZOMBIE_TTL_MS + 1)));

        service.processZombieHit(session, String.valueOf(zombieId));

        assertEquals(GameService.MISS_SCORE, gameSession.getScore());
        // The tap must claim the zombie; leaving it in the map would let the
        // resolver task charge the same zombie a second miss
        assertTrue(gameSession.getZombieSpawns().isEmpty());
    }

    @Test
    void hitExpiredZombieBroadcastsRemovalToProjection() {
        service.startGame(session);
        var gameSession = getSession(service, session.getId());
        long zombieId = 424241L;
        gameSession.getZombieSpawns().put(zombieId,
            new GameService.ZombieSpawn(zombieId, 0,
                System.currentTimeMillis() - (GameService.ZOMBIE_TTL_MS + 1)));

        service.processZombieHit(session, String.valueOf(zombieId));

        verify(broadcaster).broadcastZombieMissed(String.valueOf(zombieId));
    }

    @Test
    void malformedZombieIdCountsAsMiss() {
        service.startGame(session);
        var gameSession = getSession(service, session.getId());

        service.processZombieHit(session, "not-a-number");

        assertEquals(GameService.MISS_SCORE, gameSession.getScore());
    }

    @Test
    void endGameCancelsAutoEndTimer() {
        service.startGame(session);
        var gameSession = getSession(service, session.getId());
        var endTask = gameSession.getEndTask();
        assertNotNull(endTask);

        service.endGame(session);

        // A stale timer would end the next game started on this connection
        assertTrue(endTask.isCancelled());
    }

    @Test
    void defaultDifficultyIsEasy() {
        service.startGame(session);
        var gameSession = getSession(service, session.getId());

        assertEquals(GameService.Difficulty.EASY, gameSession.getDifficulty());
    }

    @Test
    void lightningHitScoresDouble() {
        service.startGame(session, GameService.Difficulty.LIGHTNING);
        var gameSession = getSession(service, session.getId());
        long zombieId = 424242L;
        gameSession.getZombieSpawns().put(zombieId,
            new GameService.ZombieSpawn(zombieId, 0, System.currentTimeMillis()));

        service.processZombieHit(session, String.valueOf(zombieId));

        assertEquals(GameService.Difficulty.LIGHTNING.hitScore, gameSession.getScore());
    }

    @Test
    void hardTtlExpiresFasterThanEasy() {
        service.startGame(session, GameService.Difficulty.HARD);
        var gameSession = getSession(service, session.getId());
        long zombieId = 555L;

        // Older than the HARD TTL but still alive by EASY rules
        long age = GameService.Difficulty.HARD.zombieTtlMs + 1;
        gameSession.getZombieSpawns().put(zombieId,
            new GameService.ZombieSpawn(zombieId, 0, System.currentTimeMillis() - age));

        service.processZombieHit(session, String.valueOf(zombieId));

        assertEquals(GameService.MISS_SCORE, gameSession.getScore());
    }

    @Test
    void endGameReportsFinalScore() {
        service.startGame(session);
        var gameSession = getSession(service, session.getId());
        gameSession.addScore(2);

        service.endGame(session);

        verify(broadcaster).broadcastGameStatus(argThat(evt -> !evt.isActive()));
    }

    private GameService.GameSession getSession(GameService svc, String sessionId) {
        var sessions = svc.getSessionsForTest();
        return sessions.get(sessionId);
    }
}
