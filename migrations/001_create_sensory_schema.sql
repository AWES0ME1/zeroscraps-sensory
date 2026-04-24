-- ═══════════════════════════════════════════════════════════════════════
-- @zeroscraps/sensory — Plugin Installation Migration 001
--
-- Creates the dedicated PostgreSQL schema for the plugin.
-- Run BEFORE `npx prisma migrate deploy` on the plugin schema.
-- ═══════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS sensory;

-- Enable pgvector extension (if not already). Needed for sensory.recipe_snapshots.sensory_vector.
CREATE EXTENSION IF NOT EXISTS vector;
