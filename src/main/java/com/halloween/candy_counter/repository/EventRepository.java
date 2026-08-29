package com.halloween.candy_counter.repository;

import com.halloween.candy_counter.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    @Query("SELECT COUNT(e) FROM Event e WHERE e.year = :year AND e.type = 'increment'")
    Long sumIncrementsByYear(Integer year);

    @Query("SELECT e.candyType, COUNT(e) FROM Event e WHERE e.year = :year AND e.type = 'vote' GROUP BY e.candyType")
    List<Object[]> countVotesByYear(Integer year);

    @Query("SELECT e FROM Event e WHERE e.year = :year AND e.type = 'increment' ORDER BY e.timestamp")
    List<Event> findIncrementsByYear(Integer year);
}
