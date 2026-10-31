-- V7: leaderboard columns for Graveyard Bonk scores. Rows written by the
-- old game keep NULL initials and stay off the leaderboard.
ALTER TABLE events ADD COLUMN initials VARCHAR(3);
ALTER TABLE events ADD COLUMN avg_ms INTEGER;
