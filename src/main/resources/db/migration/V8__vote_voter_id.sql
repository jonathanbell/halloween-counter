-- V8: a per-phone voter id so a vote can be changed. Only a voter's latest
-- vote counts; rows written before V8 have no voter and each count once.
ALTER TABLE events ADD COLUMN voter_id UUID;
