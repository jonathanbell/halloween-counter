package com.halloween.candy_counter.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.halloween.candy_counter.service.GameService;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.UUID;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final GameService gameService;
    private final ObjectMapper objectMapper;

    public GameWebSocketHandler(GameService gameService, ObjectMapper objectMapper) {
        this.gameService = gameService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        try {
            JsonNode payload = objectMapper.readTree(message.getPayload());
            String type = payload.has("type") ? payload.get("type").asText() : null;

            switch (type) {
                case "game_start" -> handleGameStart(session);
                case "zombie_hit" -> handleZombieHit(session, payload);
                case "game_end" -> handleGameEnd(session);
                default -> session.sendMessage(new TextMessage("{\"type\":\"error\",\"reason\":\"unknown_type\"}"));
            }
        } catch (Exception e) {
            try {
                session.sendMessage(new TextMessage("{\"type\":\"error\",\"reason\":\"internal_error\"}"));
            } catch (Exception ignored) {}
        }
    }

    private void handleGameStart(WebSocketSession session) throws Exception {
        UUID result = gameService.startGame(session);
        if (result != null) {
            session.sendMessage(new TextMessage(
                "{\"type\":\"game_started\",\"sessionId\":\"" + result + "\"}"
            ));
        } else {
            session.sendMessage(new TextMessage(
                "{\"type\":\"game_start_denied\",\"reason\":\"already_active\"}"
            ));
        }
    }

    private void handleZombieHit(WebSocketSession session, JsonNode payload) {
        String zombieId = payload.has("zombieId") && payload.get("zombieId").isTextual()
            ? payload.get("zombieId").asText() : null;
        gameService.processZombieHit(session, zombieId);
    }

    private void handleGameEnd(WebSocketSession session) {
        gameService.endGame(session);
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        gameService.handleDisconnect(session);
    }
}
