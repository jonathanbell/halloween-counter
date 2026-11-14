package com.halloween.candy_counter.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import org.springframework.lang.Nullable;
import java.time.Instant;
import java.util.UUID;
import java.util.Objects;

@Entity
@Table(name = "events")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "\"year\"", nullable = false)
    private Integer year;

    @NotNull
    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "\"timestamp\"", nullable = false, updatable = false)
    private Instant timestamp = Instant.now();

    @Column(name = "game_session_id")
    private UUID gameSessionId;

    @Column(name = "score")
    private Integer score;

    // Leaderboard fields, set only on Graveyard Bonk `game_score` rows
    @Column(name = "initials")
    private String initials;

    @Column(name = "avg_ms")
    private Integer avgMs;

    public Event() {}

    public Event(String type, Integer year) {
        this.type = type;
        this.year = year;
    }

    public Event(String type, Integer year, UUID gameSessionId, Integer score) {
        this.type = type;
        this.year = year;
        this.gameSessionId = gameSessionId;
        this.score = score;
    }

    public static Event gameScore(Integer year, UUID sessionId, int score,
                                  String initials, @Nullable Integer avgMs) {
        Event event = new Event("game_score", year, sessionId, score);
        event.initials = initials;
        event.avgMs = avgMs;
        return event;
    }

    public Long getId() { return id; }
    public Integer getYear() { return year; }
    public String getType() { return type; }
    public Instant getTimestamp() { return timestamp; }
    public UUID getGameSessionId() { return gameSessionId; }
    public Integer getScore() { return score; }
    public String getInitials() { return initials; }
    public Integer getAvgMs() { return avgMs; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Event)) return false;
        Event other = (Event) o;

        // Unsaved entities (null id) are never equal to each other
        return id != null && Objects.equals(id, other.id);
    }

    @Override
    public int hashCode() {
        // Constant: id is assigned on persist, so it cannot feed the hash
        return Event.class.hashCode();
    }

    @Override
    public String toString() {
        return String.format("Event[id=%d, type=%s, year=%d, timestamp=%s]", id, type, year, timestamp);
    }
}
