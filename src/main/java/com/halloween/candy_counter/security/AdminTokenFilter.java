package com.halloween.candy_counter.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@Component
public class AdminTokenFilter extends OncePerRequestFilter {

    private final String adminToken;
    private final String settingsToken;

    public AdminTokenFilter(
        @Value("${admin.token:default-admin-change-me}") String adminToken,
        @Value("${admin.settings-token:default-settings-change-me}") String settingsToken) {
        this.adminToken = adminToken;
        this.settingsToken = settingsToken;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        String path = request.getRequestURI();
        return !path.startsWith("/api/counter") &&
               !path.startsWith("/api/settings");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                  FilterChain chain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String providedToken = (authHeader != null && authHeader.startsWith("Bearer "))
            ? authHeader.substring(7)
            : request.getParameter("token");

        boolean isAdminEndpoint = request.getRequestURI().startsWith("/api/counter");
        boolean isSettingsEndpoint = request.getRequestURI().startsWith("/api/settings");

        String requiredToken = isSettingsEndpoint ? settingsToken : adminToken;

        if (requiredToken.equals(providedToken)) {
            chain.doFilter(request, response);
        } else {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\":\"invalid_token\"}");
        }
    }
}
