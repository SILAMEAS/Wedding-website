-- Runs once when the local container is first created.
-- A separate database for integration tests so tests never touch dev data.
CREATE DATABASE wedding_test OWNER wedding;
