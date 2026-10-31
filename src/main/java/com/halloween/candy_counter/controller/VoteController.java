package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.domain.CandyOption;
import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.service.CounterService;
import com.halloween.candy_counter.service.SettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/vote")
public class VoteController {

    private final CounterService counterService;
    private final SettingsService settingsService;

    public VoteController(CounterService counterService, SettingsService settingsService) {
        this.counterService = counterService;
        this.settingsService = settingsService;
    }

    @PostMapping
    public ResponseEntity<?> vote(@Valid @RequestBody VoteRequest request) {
        // Only the admin's options are votable, so the chart holds no junk
        if (!settingsService.isCandyOption(request.year(), request.candyType())) {
            return ResponseEntity.badRequest().body(Map.of("error", "unknown_candy"));
        }

        Event event = counterService.vote(request.year(), request.candyType(), request.voterId());
        return ResponseEntity.ok(event);
    }

    @GetMapping("/options")
    public List<CandyOption> options(@RequestParam(defaultValue = "2026") Integer year) {
        return settingsService.getCandyOptions(year);
    }

    // voterId is optional so a page cached before V8 can still vote
    public record VoteRequest(
        @NotNull Integer year,
        @NotBlank String candyType,
        @Nullable UUID voterId
    ) {}
}
