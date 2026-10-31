package com.halloween.candy_counter.service;

import com.halloween.candy_counter.model.Token;
import com.halloween.candy_counter.repository.TokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class TokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final TokenRepository tokenRepository;
    private final String envAdminToken;
    private final String envSettingsToken;

    public TokenService(TokenRepository tokenRepository,
                        @Value("${admin.token:default-admin-change-me}") String envAdminToken,
                        @Value("${admin.settings-token:default-settings-change-me}") String envSettingsToken) {
        this.tokenRepository = tokenRepository;
        this.envAdminToken = envAdminToken;
        this.envSettingsToken = envSettingsToken;
    }

    /**
     * Resolve the active token: DB override wins, env var is the fallback.
     */
    @SuppressWarnings("null")
    public String resolveToken(String name) {
        Optional<Token> dbToken = tokenRepository.findById(name);
        if (dbToken.isPresent()) return dbToken.get().getValue();
        return "settings".equals(name) ? envSettingsToken : envAdminToken;
    }

    @Transactional
    @SuppressWarnings("null")
    public String rotate(String name) {
        String newToken = generateToken();
        Token token = tokenRepository.findById(name)
            .orElse(new Token(name, newToken));
        token.setValue(newToken);
        token.setUpdatedAt(Instant.now());
        tokenRepository.save(token);
        return newToken;
    }

    private String generateToken() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
