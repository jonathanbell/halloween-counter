package com.halloween.candy_counter.model;

import jakarta.persistence.Column;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "settings")
public class Settings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "\"year\"", nullable = false, unique = true)
    private Integer year;

    @Column(name = "initial_candy_count", nullable = false)
    private Integer initialCandyCount = 300;

    @Column(name = "active_game_session")
    private UUID activeGameSession;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Settings() {}

    public Settings(Integer year, Integer initialCandyCount) {
        this.year = year;
        this.initialCandyCount = initialCandyCount;
    }

    public Long getId() { return id; }
    public Integer getYear() { return year; }
    public Integer getInitialCandyCount() { return initialCandyCount; }
    public UUID getActiveGameSession() { return activeGameSession; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setYear(Integer year) { this.year = year; }
    public void setInitialCandyCount(Integer initialCandyCount) { this.initialCandyCount = initialCandyCount; }
    public void setActiveGameSession(UUID session) { this.activeGameSession = session; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
