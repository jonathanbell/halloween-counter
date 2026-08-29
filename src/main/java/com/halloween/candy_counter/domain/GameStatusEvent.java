package com.halloween.candy_counter.domain;

import java.time.Instant;
import java.util.UUID;

public class GameStatusEvent {
    private final boolean active;
    private final UUID sessionId;
    private final Instant timestamp = Instant.now();

    public GameStatusEvent(boolean active, UUID sessionId) {
        this.active = active;
        this.sessionId = sessionId;
    }

    public boolean isActive() { return active; }
    public UUID getSessionId() { return sessionId; }
    public Instant getTimestamp() { return timestamp; }
}
