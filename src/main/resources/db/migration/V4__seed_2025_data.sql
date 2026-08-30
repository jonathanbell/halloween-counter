-- V4: Seed 2025 data (346 total candies)
-- count_adjustment=345 plus one synthetic increment event at 6pm PDT on
-- 2025-10-31 gives total=346 (345 + 1) and one histogram bucket.

INSERT INTO settings ("year", initial_candy_count, count_adjustment)
VALUES (2025, 346, 345);

INSERT INTO events ("year", "timestamp", type)
VALUES (2025, '2025-10-31T18:00:00-07:00', 'increment');
