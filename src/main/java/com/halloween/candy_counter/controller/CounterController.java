package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.model.Event;
import com.halloween.candy_counter.service.CounterService;
import com.halloween.candy_counter.service.SseBroadcaster;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class CounterController {

    private final CounterService counterService;
    private final SseBroadcaster sseBroadcaster;

    public CounterController(CounterService counterService, SseBroadcaster sseBroadcaster) {
        this.counterService = counterService;
        this.sseBroadcaster = sseBroadcaster;
    }

    @PostMapping(value = "/counter", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Event increment(@Valid @RequestBody IncrementRequest request) {
        return counterService.increment(request.year());
    }

    @GetMapping("/state")
    public Map<String, Object> state(@RequestParam(defaultValue = "2026") Integer year) {
        return counterService.getState(year);
    }

    @GetMapping("/events")
    public SseEmitter streamEvents() {
        return sseBroadcaster.subscribe();
    }

    // @NotNull turns a missing year into a 400 instead of a DB-level 500
    public record IncrementRequest(@NotNull Integer year) {}
}
