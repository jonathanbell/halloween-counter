package com.halloween.candy_counter.service;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.repository.EventRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

// Persists finished Graveyard Bonk games and answers "where do I rank?".
// The live game (GameService) talks to this, never to the repository.
@Service
public class LeaderboardService {

    static final int MAX_LIMIT = 500;

    private final EventRepository eventRepository;

    public LeaderboardService(EventRepository eventRepository) {
        this.eventRepository = eventRepository;
    }

    public record Entry(long id, String initials, int score, @Nullable Integer avgMs, String timestamp) {
        static Entry of(Event e) {
            return new Entry(e.getId(), e.getInitials(), e.getScore(), e.getAvgMs(),
                e.getTimestamp().toString());
        }
    }

    public record Placement(long scoreId, int rank) {}

    public Placement record(int year, UUID sessionId, int score, String initials, @Nullable Integer avgMs) {
        Event saved = eventRepository.save(Event.gameScore(year, sessionId, score, initials, avgMs));

        // Counted after the save, so a tie shares the better rank (ties do
        // not count as "above")
        return new Placement(saved.getId(), rank(year, score));
    }

    public int rank(int year, int score) {
        return (int) eventRepository.countScoresAbove(year, score) + 1;
    }

    public List<Entry> top(int year, int limit) {
        int capped = Math.max(1, Math.min(limit, MAX_LIMIT));
        return eventRepository.findLeaderboard(year, PageRequest.of(0, capped))
            .stream()
            .map(Entry::of)
            .toList();
    }
}
