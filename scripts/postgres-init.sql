-- Runs once on first `docker compose up` (container creates the volume +
-- invokes every *.sql in /docker-entrypoint-initdb.d). POSTGRES_DB above
-- already creates immo_dev; we add immo_test for the Vitest harness.
CREATE DATABASE immo_test;
