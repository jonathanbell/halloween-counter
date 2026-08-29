package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.model.Settings;
import com.halloween.candy_counter.service.SettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ResponseEntity<Settings> get(@RequestParam("year") Integer year) {
        Optional<Settings> settings = settingsService.getSettings(year);
        return settings.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Settings update(@RequestParam("year") Integer year,
                          @RequestParam("initialCandyCount") Integer initialCandyCount) {
        return settingsService.updateSettings(year, initialCandyCount);
    }
}
