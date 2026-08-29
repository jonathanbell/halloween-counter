package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.service.CounterService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@RestController
@RequestMapping("/api/vote")
public class VoteController {

    private final CounterService counterService;

    public VoteController(CounterService counterService) {
        this.counterService = counterService;
    }

    @PostMapping
    public ResponseEntity<Event> vote(@Valid @RequestBody VoteRequest request) {
        Event event = counterService.vote(request.year(), request.candyType());
        return ResponseEntity.ok(event);
    }

    public record VoteRequest(
        @NotNull Integer year,
        @NotBlank String candyType
    ) {}
}
