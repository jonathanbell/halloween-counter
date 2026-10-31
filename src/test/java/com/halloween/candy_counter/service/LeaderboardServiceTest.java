package com.halloween.candy_counter.service;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.repository.EventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.openMocks;

class LeaderboardServiceTest {

    @Mock EventRepository eventRepository;
    LeaderboardService service;

    @BeforeEach
    void setUp() {
        openMocks(this);
        service = new LeaderboardService(eventRepository);
    }

    @Test
    @SuppressWarnings("null")
    void recordSavesInitialsAndReportsRank() {
        UUID sessionId = UUID.randomUUID();
        when(eventRepository.save(any(Event.class))).thenAnswer(inv -> withId(inv.getArgument(0), 42L));
        when(eventRepository.countScoresAbove(2026, 3140)).thenReturn(3L);

        LeaderboardService.Placement placement = service.record(2026, sessionId, 3140, "JB", 287);

        assertEquals(42L, placement.scoreId());
        assertEquals(4, placement.rank());
        verify(eventRepository).save(argThat(e ->
            "game_score".equals(e.getType())
                && "JB".equals(e.getInitials())
                && e.getAvgMs() == 287
                && e.getScore() == 3140
                && sessionId.equals(e.getGameSessionId())));
    }

    @Test
    void rankIsOneWhenNobodyIsAbove() {
        when(eventRepository.countScoresAbove(2026, 9000)).thenReturn(0L);

        assertEquals(1, service.rank(2026, 9000));
    }

    @Test
    @SuppressWarnings("null")
    void topCapsTheLimit() {
        when(eventRepository.findLeaderboard(eq(2026), any(Pageable.class))).thenReturn(List.of());

        service.top(2026, 10_000);

        verify(eventRepository).findLeaderboard(eq(2026),
            argThat(p -> p.getPageSize() == LeaderboardService.MAX_LIMIT));
    }

    @Test
    void topMapsRows() {
        Event row = withId(Event.gameScore(2026, UUID.randomUUID(), 5000, "BOO", null), 7L);
        when(eventRepository.findLeaderboard(eq(2026), any(Pageable.class))).thenReturn(List.of(row));

        List<LeaderboardService.Entry> top = service.top(2026, 5);

        assertEquals(1, top.size());
        assertEquals(7L, top.get(0).id());
        assertEquals("BOO", top.get(0).initials());
        assertEquals(5000, top.get(0).score());
        assertNull(top.get(0).avgMs());
    }

    // Event ids are assigned on persist; tests stand in for the database
    private static Event withId(Event event, long id) {
        ReflectionTestUtils.setField(event, "id", id);
        return event;
    }
}
