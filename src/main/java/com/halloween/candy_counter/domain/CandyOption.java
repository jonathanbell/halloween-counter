package com.halloween.candy_counter.domain;

import org.springframework.lang.Nullable;

// One favorite-candy choice. `id` is what votes store, so it never changes
// once set; `label` and `imageUrl` are free to edit
public record CandyOption(@Nullable String id, String label, @Nullable String imageUrl) {
}
