package com.halloween.candy_counter.security;

import com.halloween.candy_counter.service.TokenService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@Component
public class AdminTokenFilter extends OncePerRequestFilter {

    private final TokenService tokenService;

    public AdminTokenFilter(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        String path = request.getRequestURI();
        return !path.startsWith("/api/counter") &&
               !path.startsWith("/api/settings") &&
               !path.startsWith("/api/tokens");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                  FilterChain chain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String providedToken = (authHeader != null && authHeader.startsWith("Bearer "))
            ? authHeader.substring(7)
            : request.getParameter("token");

        String path = request.getRequestURI();
        // Token rotation requires the settings token (highest privilege)
        String tokenName = (path.startsWith("/api/settings") || path.startsWith("/api/tokens"))
            ? "settings" : "admin";

        String requiredToken = tokenService.resolveToken(tokenName);

        if (requiredToken.equals(providedToken)) {
            chain.doFilter(request, response);
        } else {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\":\"invalid_token\"}");
        }
    }
}
