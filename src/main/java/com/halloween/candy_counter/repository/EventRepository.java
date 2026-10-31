package com.halloween.candy_counter.repository;

import com.halloween.candy_counter.model.Event;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long> {

    @Query("SELECT COUNT(e) FROM Event e WHERE e.year = :year AND e.type = 'increment'")
    Long countIncrementsByYear(Integer year);

    // One vote per voter: only their latest row counts, so a phone can
    // change its mind. Rows without a voter (before V8) count once each
    @Query("SELECT e.candyType, COUNT(e) FROM Event e WHERE e.year = :year AND e.type = 'vote' "
        + "AND (e.voterId IS NULL OR e.id = (SELECT MAX(v.id) FROM Event v "
        + "WHERE v.year = :year AND v.type = 'vote' AND v.voterId = e.voterId)) "
        + "GROUP BY e.candyType")
    List<Object[]> countVotesByYear(Integer year);

    @Query("SELECT e FROM Event e WHERE e.year = :year AND e.type = 'increment' ORDER BY e.timestamp")
    List<Event> findIncrementsByYear(Integer year);

    // Leaderboard rows only: old Whack-a-Zombie scores have no initials.
    // Ties go to whoever set the score first
    @Query("SELECT e FROM Event e WHERE e.year = :year AND e.type = 'game_score' "
        + "AND e.initials IS NOT NULL ORDER BY e.score DESC, e.timestamp ASC")
    List<Event> findLeaderboard(Integer year, Pageable page);

    @Query("SELECT COUNT(e) FROM Event e WHERE e.year = :year AND e.type = 'game_score' "
        + "AND e.initials IS NOT NULL AND e.score > :score")
    long countScoresAbove(Integer year, Integer score);
}
