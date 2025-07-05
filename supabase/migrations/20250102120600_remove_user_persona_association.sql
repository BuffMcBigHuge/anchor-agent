-- Migration: Remove user-persona association
-- Purpose: Decouple users from personas - personas are only for anchors
-- Date: 2025-01-02
-- Tables: users (remove persona_id column)

-- Remove the persona_id column from users table
alter table public.users drop column if exists persona_id;

-- Remove any foreign key constraints related to user personas
-- (This will automatically be handled by dropping the column) 