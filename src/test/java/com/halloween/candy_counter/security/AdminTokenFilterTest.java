package com.halloween.candy_counter.security;

import com.halloween.candy_counter.service.TokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.mockito.Mockito.*;
import static org.mockito.MockitoAnnotations.openMocks;

class AdminTokenFilterTest {

    AdminTokenFilter filter;
    @Mock TokenService tokenService;
    @Mock HttpServletRequest request;
    @Mock HttpServletResponse response;
    @Mock FilterChain chain;

    @BeforeEach
    void setUp() {
        openMocks(this);
        filter = new AdminTokenFilter(tokenService);
        when(tokenService.resolveToken("admin")).thenReturn("admin-token");
        when(tokenService.resolveToken("settings")).thenReturn("settings-token");
    }

    @Test
    void skipsNonAdminPath() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/events");
        org.junit.jupiter.api.Assertions.assertTrue(filter.shouldNotFilter(request));
    }

    @Test
    void protectedPathsDoNotSkip() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/counter");
        org.junit.jupiter.api.Assertions.assertFalse(filter.shouldNotFilter(request));

        when(request.getRequestURI()).thenReturn("/api/settings");
        org.junit.jupiter.api.Assertions.assertFalse(filter.shouldNotFilter(request));

        when(request.getRequestURI()).thenReturn("/api/tokens/rotate");
        org.junit.jupiter.api.Assertions.assertFalse(filter.shouldNotFilter(request));
    }

    @Test
    void adminEndpointAccepted() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/counter");
        when(request.getParameter("token")).thenReturn("admin-token");

        filter.doFilterInternal(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void wrongTokenBlocked() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/counter");
        when(request.getParameter("token")).thenReturn("wrong");

        StringWriter sw = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(sw));

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(request, response);
    }

    @Test
    void blankConfiguredTokenRejectsEverything() throws Exception {
        when(tokenService.resolveToken("admin")).thenReturn("");
        when(request.getRequestURI()).thenReturn("/api/counter");
        when(request.getParameter("token")).thenReturn("");

        StringWriter sw = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(sw));

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(request, response);
    }

    @Test
    void settingsEndpointUsesSettingsToken() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/settings");
        when(request.getParameter("token")).thenReturn("settings-token");

        filter.doFilterInternal(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void bearerHeaderAccepted() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/counter");
        when(request.getHeader("Authorization")).thenReturn("Bearer admin-token");

        filter.doFilterInternal(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenRotationRequiresSettingsToken() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/tokens/rotate");
        when(request.getParameter("token")).thenReturn("settings-token");

        filter.doFilterInternal(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenRotationRejectsAdminToken() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/tokens/rotate");
        when(request.getParameter("token")).thenReturn("admin-token");

        StringWriter sw = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(sw));

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    }
}
