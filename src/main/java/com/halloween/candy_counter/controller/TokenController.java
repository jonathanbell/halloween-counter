package com.halloween.candy_counter.controller;

import com.halloween.candy_counter.service.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/tokens")
public class TokenController {

    private final TokenService tokenService;

    public TokenController(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    /**
     * Rotate a token. Protected by the settings token (highest privilege).
     * Body: {"name": "admin"} or {"name": "settings"}
     * Returns the new token value — caller must re-print QR codes.
     */
    @PostMapping("/rotate")
    public ResponseEntity<Map<String, String>> rotate(@RequestBody RotateRequest request) {
        String name = request.name();
        if (!"admin".equals(name) && !"settings".equals(name)) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid_token_name"));
        }

        String newToken = tokenService.rotate(name);
        return ResponseEntity.ok(Map.of(
            "name", name,
            "token", newToken,
            "warning", "QR codes must be regenerated: npm run qr <publicUrl> <adminToken> <settingsToken>"
        ));
    }

    public record RotateRequest(String name) {}
}
