-- V9: per-year favorite-candy options, edited on the settings page. JSON
-- text ([{id,label,imageUrl}]) rather than JSON/JSONB so H2 and Postgres
-- agree on the type. 2026 keeps the old hardcoded ids so its votes count.
ALTER TABLE settings ADD COLUMN candy_options TEXT;

UPDATE settings SET candy_options = '[{"id":"snickers","label":"🍫 Snickers","imageUrl":null},{"id":"m&ms","label":"🟤 M&M''s","imageUrl":null},{"id":"twix","label":"🍪 Twix","imageUrl":null}]'
WHERE "year" = 2026;
