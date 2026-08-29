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

    @Query("SELECT COUNT(e) FROM Event e WHERE e.year = :year AND e.type = 'vote' AND e.candyType = :candyType")
    Long countVotesByYearAndCandyType(Integer year, String candyType);

    @Query("SELECT e FROM Event e WHERE e.year = :year")
    List<Event> findEventsByYear(Integer year);

    @Query("SELECT COUNT(e) FROM Event e WHERE e.type = 'effect_lightning'")
    Long countLightningEffects();

    @Query("SELECT COUNT(e) FROM Event e WHERE e.type = 'effect_candy_rain'")
    Long countCandyRainEffects();
}
