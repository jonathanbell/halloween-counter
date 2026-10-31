package com.halloween.candy_counter.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.halloween.candy_counter.model.Token;

public interface TokenRepository extends JpaRepository<Token, String> {
}
