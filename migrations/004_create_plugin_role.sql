-- Migration 004: Compartmentalize plugin DB access.
--
-- Today the plugin connects to PostgreSQL using the host's role, which has
-- full GRANT on every schema (auth.*, recipe.*, sensory.*, ...). A compromised
-- plugin = full database compromise (password hashes, recipes, everything).
--
-- This migration creates a `sensory_plugin` role with rights ONLY in the
-- sensory schema + the public schema entries the pgvector extension needs.
-- Once SENSORY_DATABASE_URL points at this role, plugin-side RCE can no
-- longer read auth.users.
--
-- Apply order:
--   1. Generate a strong password and store it in Azure Key Vault as
--      `sensory-plugin-db-password`.
--   2. Run this script as the DB superuser. It is idempotent (safe to re-run)
--      EXCEPT for the CREATE ROLE password — that's only set on first run.
--   3. Add the Container App env var `SENSORY_DATABASE_URL` referencing the
--      Key Vault secret. Format:
--        postgresql://sensory_plugin:<PWD>@<host>:5432/<db>?sslmode=require
--   4. Restart the API. Verify the plugin still works
--      (POST /api/sensory/admin/snapshot-stats).
--
-- Rollback: drop the env var. Plugin falls back to DATABASE_URL.
--           Optionally `DROP ROLE sensory_plugin` after revocation.

-- =============================================================
-- 1. Create the role (skip if it already exists).
--    Password should be set via:
--      ALTER ROLE sensory_plugin PASSWORD '<...>';
--    out-of-band, so it never lives in source control.
-- =============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sensory_plugin') THEN
    -- Placeholder password; ALTER ROLE ... PASSWORD '<from KeyVault>'; after.
    CREATE ROLE sensory_plugin LOGIN PASSWORD 'CHANGEME_RUN_ALTER_ROLE';
  END IF;
END $$;

-- Defense in depth: even if the role's password leaks, prevent it from
-- creating new schemas, becoming a superuser, or replicating.
ALTER ROLE sensory_plugin
  NOSUPERUSER
  NOCREATEROLE
  NOCREATEDB
  NOREPLICATION
  NOBYPASSRLS;

-- =============================================================
-- 2. Grant exactly what the plugin needs — nothing more.
-- =============================================================

-- Schema usage
GRANT USAGE ON SCHEMA sensory TO sensory_plugin;

-- Existing tables: full DML
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sensory
  TO sensory_plugin;

-- Sequences (cuid() defaults still need nextval)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA sensory
  TO sensory_plugin;

-- Future tables created in this schema (e.g. via plugin migrations) inherit
-- the same grants automatically. Without this every new table requires a
-- manual GRANT.
ALTER DEFAULT PRIVILEGES IN SCHEMA sensory
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sensory_plugin;
ALTER DEFAULT PRIVILEGES IN SCHEMA sensory
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sensory_plugin;

-- pgvector type lives in the `public` schema. Plugin needs to USE the schema
-- so vector(N) cast resolves; it must NOT have CREATE rights there.
GRANT USAGE ON SCHEMA public TO sensory_plugin;

-- =============================================================
-- 3. Explicitly REVOKE access to host-owned schemas.
--    PUBLIC has no default schema access in Postgres 15+, but make this
--    intent explicit so future migrations don't accidentally grant it.
-- =============================================================
REVOKE ALL ON SCHEMA auth      FROM sensory_plugin;
REVOKE ALL ON SCHEMA recipe    FROM sensory_plugin;
REVOKE ALL ON SCHEMA catalog   FROM sensory_plugin;
REVOKE ALL ON SCHEMA meal      FROM sensory_plugin;
REVOKE ALL ON SCHEMA fitness   FROM sensory_plugin;
REVOKE ALL ON SCHEMA system    FROM sensory_plugin;
REVOKE ALL ON SCHEMA community FROM sensory_plugin;
REVOKE ALL ON SCHEMA analytics FROM sensory_plugin;
REVOKE ALL ON SCHEMA archive   FROM sensory_plugin;

-- =============================================================
-- 4. Verify (run after applying):
--   \du+ sensory_plugin
--   SELECT has_schema_privilege('sensory_plugin', 'sensory', 'USAGE'); -- t
--   SELECT has_schema_privilege('sensory_plugin', 'auth',    'USAGE'); -- f
--   SELECT has_table_privilege('sensory_plugin',
--          'sensory.recipe_snapshots', 'SELECT'); -- t
-- =============================================================
