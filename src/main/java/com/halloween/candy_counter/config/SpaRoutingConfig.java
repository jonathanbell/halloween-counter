package com.halloween.candy_counter.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves index.html for the frontend's client-side routes.
 *
 * App.tsx routes on window.location.pathname, so /game and /stats must
 * return the SPA shell on a full page load. Vite's dev server does this
 * automatically, which is why the missing fallback only showed up in
 * production: Spring Boot serves real files and 404s on paths that are
 * not one.
 *
 * Listed explicitly rather than as a catch-all so that /api, the static
 * admin pages, and genuinely missing paths still 404 honestly.
 */
@Configuration
public class SpaRoutingConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/game").setViewName("forward:/index.html");
        registry.addViewController("/stats").setViewName("forward:/index.html");
    }
}
