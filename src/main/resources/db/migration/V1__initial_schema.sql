-- Initial migration: events table
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(20) NOT NULL CHECK (type IN ('increment', 'effect_lightning', 'effect_candy_rain', 'vote')),
    candy_type VARCHAR(50),
    game_session_id UUID,
    score INTEGER
);

-- Index for year filtering
CREATE INDEX idx_events_year ON events("year");

-- Index for timestamp range queries (charts)
CREATE INDEX idx_events_timestamp ON events("timestamp");

-- Index for type filtering
CREATE INDEX idx_events_type ON events(type);

-- Index for game session filtering
CREATE INDEX idx_events_game_session ON events(game_session_id);
