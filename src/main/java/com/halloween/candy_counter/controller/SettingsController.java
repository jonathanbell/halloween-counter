package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.service.SettingsService;
import com.halloween.candy_counter.service.SseBroadcaster;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settingsService;
    private final SseBroadcaster sseBroadcaster;

    public SettingsController(SettingsService settingsService, SseBroadcaster sseBroadcaster) {
        this.settingsService = settingsService;
        this.sseBroadcaster = sseBroadcaster;
    }

    @GetMapping
    public Map<String, Object> get(@RequestParam("year") Integer year) {
        return body(settingsService.tally(year));
    }

    @PostMapping
    public Map<String, Object> update(@Valid @RequestBody SettingsUpdateRequest request) {
        SettingsService.Tally tally = settingsService.update(
            request.year(), request.initialCandyCount(), request.currentTotal());

        // Push updated total to all SSE clients immediately
        sseBroadcaster.broadcastCountSnapshot(request.year());
        return body(tally);
    }

    private static Map<String, Object> body(SettingsService.Tally tally) {
        return Map.of(
            "year", tally.year(),
            "initialCandyCount", tally.initialCandyCount(),
            "countAdjustment", tally.countAdjustment(),
            "eventTotal", tally.eventTotal(),
            "currentTotal", tally.total(),
            "candyRemaining", tally.candyRemaining());
    }

    // @NotNull turns a missing year into a 400 instead of a guess
    public record SettingsUpdateRequest(
        @NotNull Integer year,
        Integer initialCandyCount,
        Integer currentTotal
    ) {}
}
