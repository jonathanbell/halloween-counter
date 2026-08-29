package com.halloween.candy_counter.security;

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
    @Mock HttpServletRequest request;
    @Mock HttpServletResponse response;
    @Mock FilterChain chain;

    @BeforeEach
    void setUp() {
        openMocks(this);
        filter = new AdminTokenFilter("admin-token", "settings-token");
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
}
