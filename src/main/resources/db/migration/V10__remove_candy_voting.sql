-- Remove historical vote records and the schema used only by candy voting.
DELETE FROM events WHERE type = 'vote';

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('increment', 'effect_lightning', 'effect_candy_rain', 'game_score'));

ALTER TABLE events DROP COLUMN candy_type;
ALTER TABLE events DROP COLUMN voter_id;
ALTER TABLE settings DROP COLUMN candy_options;
