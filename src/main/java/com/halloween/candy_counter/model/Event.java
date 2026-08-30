package com.halloween.candy_counter.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
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

    @Column(name = "candy_type")
    private String candyType;

    @Column(name = "game_session_id")
    private UUID gameSessionId;

    @Column(name = "score")
    private Integer score;

    public Event() {}

    public Event(String type, Integer year) {
        this.type = type;
        this.year = year;
    }

    public Event(String type, Integer year, String candyType, UUID gameSessionId, Integer score) {
        this.type = type;
        this.year = year;
        this.candyType = candyType;
        this.gameSessionId = gameSessionId;
        this.score = score;
    }

    public Long getId() { return id; }
    public Integer getYear() { return year; }
    public String getType() { return type; }
    public Instant getTimestamp() { return timestamp; }
    public String getCandyType() { return candyType; }
    public UUID getGameSessionId() { return gameSessionId; }
    public Integer getScore() { return score; }

    public void setYear(Integer year) { this.year = year; }
    public void setType(String type) { this.type = type; }
    public void setCandyType(String candyType) { this.candyType = candyType; }
    public void setGameSessionId(UUID gameSessionId) { this.gameSessionId = gameSessionId; }
    public void setScore(Integer score) { this.score = score; }

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
