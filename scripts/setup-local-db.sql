-- One-time setup for a local PostgreSQL install (any version 16+).
--
-- Run it once as the postgres superuser:
--   psql -U postgres -f scripts/setup-local-db.sql
--
-- It creates:
--   - a login "artweb" (password "artweb"; local development only)
--   - the database "artweb" for running the app
--   - the database "artweb_test" for the API tests
-- These match the defaults in .env.example and apps/api/test/helpers.ts.
-- Safe to run again: anything that already exists is skipped.

SELECT 'CREATE ROLE artweb LOGIN PASSWORD ''artweb'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'artweb')\gexec

-- The owner of a database may create tables in it, which the migrations need.
SELECT 'CREATE DATABASE artweb OWNER artweb'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'artweb')\gexec

SELECT 'CREATE DATABASE artweb_test OWNER artweb'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'artweb_test')\gexec
