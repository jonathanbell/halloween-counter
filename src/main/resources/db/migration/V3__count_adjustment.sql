-- V3: count adjustment for manual overrides (total = events + adjustment)
ALTER TABLE settings ADD COLUMN count_adjustment INTEGER NOT NULL DEFAULT 0;
