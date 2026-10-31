package com.halloween.candy_counter.domain;

import org.springframework.lang.Nullable;

import java.time.Instant;
import java.util.UUID;

// game_status over SSE: tells every screen a game started or ended, who is
// playing, and how long is left (phones use it for the "12s left" lockout)
public class GameStatusEvent {
    private final boolean active;
    private final UUID sessionId;
    private final String initials;
    private final long endsInMs;
    private final Instant timestamp = Instant.now();

    private GameStatusEvent(boolean active, UUID sessionId, String initials, long endsInMs) {
        this.active = active;
        this.sessionId = sessionId;
        this.initials = initials;
        this.endsInMs = endsInMs;
    }

    public static GameStatusEvent started(UUID sessionId, String initials, long endsInMs) {
        return new GameStatusEvent(true, sessionId, initials, endsInMs);
    }

    public static GameStatusEvent ended(UUID sessionId, String initials) {
        return new GameStatusEvent(false, sessionId, initials, 0);
    }

    public boolean isActive() { return active; }
    public UUID getSessionId() { return sessionId; }
    @Nullable public String getInitials() { return initials; }
    public long getEndsInMs() { return endsInMs; }
    public Instant getTimestamp() { return timestamp; }
}
