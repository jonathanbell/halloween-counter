package com.halloween.candy_counter.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

// A write outside Halloween night. 423 over HTTP; the game's WebSocket
// handler turns it into game_start_denied
@ResponseStatus(HttpStatus.LOCKED)
public class FrozenException extends RuntimeException {
}
