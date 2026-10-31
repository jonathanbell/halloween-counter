package com.halloween.candy_counter.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.halloween.candy_counter.service.GameService;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

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

            // A string switch NPEs on null, which would masquerade as internal_error
            if (type == null) {
                sendError(session, "unknown_type");
                return;
            }

            switch (type) {
                case "game_start" -> handleGameStart(session, payload);
                case "pop_shown" -> handleShown(session, payload);
                case "bonk" -> handleBonk(session, payload);
                case "tap" -> handleTap(session, payload);
                case "game_quit" -> gameService.quitGame(session);
                default -> sendError(session, "unknown_type");
            }
        } catch (Exception e) {
            try {
                sendError(session, "internal_error");
            } catch (Exception ignored) {}
        }
    }

    private void handleGameStart(WebSocketSession session, JsonNode payload) throws Exception {
        String initials = payload.path("initials").isTextual() ? payload.get("initials").asText() : null;

        // On success GameService replies with game_started (it carries the
        // schedule). A denial says who is playing and for how long
        if (gameService.startGame(session, initials) != null) return;

        ObjectNode denied = objectMapper.createObjectNode();
        denied.put("type", "game_start_denied");
        denied.put("reason", "already_active");
        denied.put("initials", gameService.activeInitials());
        denied.put("endsInMs", gameService.endsInMs());
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(denied)));
    }

    private void handleShown(WebSocketSession session, JsonNode payload) throws Exception {
        if (!payload.path("id").canConvertToInt()) {
            sendError(session, "invalid_payload");
            return;
        }
        gameService.onShown(session, payload.get("id").asInt());
    }

    private void handleBonk(WebSocketSession session, JsonNode payload) throws Exception {
        if (!payload.path("id").canConvertToInt() || !payload.path("ms").isNumber()) {
            sendError(session, "invalid_payload");
            return;
        }
        gameService.onBonk(session, payload.get("id").asInt(), payload.get("ms").asLong());
    }

    private void handleTap(WebSocketSession session, JsonNode payload) throws Exception {
        if (!payload.path("x").isNumber() || !payload.path("z").isNumber()) {
            sendError(session, "invalid_payload");
            return;
        }
        gameService.onTap(session, payload.get("x").asDouble(), payload.get("z").asDouble());
    }

    private void sendError(WebSocketSession session, String reason) throws Exception {
        session.sendMessage(new TextMessage("{\"type\":\"error\",\"reason\":\"" + reason + "\"}"));
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        gameService.handleDisconnect(session);
    }
}
