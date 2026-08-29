-- Settings table for current year / initial candy allocation
CREATE TABLE settings (
    id BIGSERIAL PRIMARY KEY,
    "year" INTEGER NOT NULL UNIQUE,
    initial_candy_count INTEGER NOT NULL DEFAULT 300,
    active_game_session UUID,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO settings ("year", initial_candy_count) VALUES (2026, 300);

CREATE INDEX idx_settings_year ON settings("year");
