package com.halloween.candy_counter.domain;

import java.time.Instant;

public record EventMessage(String type, Integer year, Integer total,
                           Integer initialCandyCount, Instant timestamp) {
}
