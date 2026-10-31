package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.service.LeaderboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leaderboard")
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    public LeaderboardController(LeaderboardService leaderboardService) {
        this.leaderboardService = leaderboardService;
    }

    // Public, like /api/stats. The service caps `limit` at 500
    @GetMapping
    public List<LeaderboardService.Entry> leaderboard(
            @RequestParam(defaultValue = "2026") Integer year,
            @RequestParam(defaultValue = "500") Integer limit) {
        return leaderboardService.top(year, limit);
    }
}
