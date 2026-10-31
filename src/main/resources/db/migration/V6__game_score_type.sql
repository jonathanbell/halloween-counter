ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('increment', 'effect_lightning', 'effect_candy_rain', 'vote', 'game_score'));