package com.halloween.candy_counter.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.halloween.candy_counter.model.Settings;

public interface SettingsRepository extends JpaRepository<Settings, Long> {

    Optional<Settings> findByYear(Integer year);
}
