-- V5: tokens table for runtime token rotation
CREATE TABLE tokens (
    name VARCHAR(20) PRIMARY KEY CHECK (name IN ('admin', 'settings')),
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
