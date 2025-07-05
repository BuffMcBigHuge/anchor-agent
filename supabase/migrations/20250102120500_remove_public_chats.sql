-- Migration: Remove public chat functionality
-- Purpose: Simplify the system by removing public chat concept
-- Date: 2025-01-02
-- Tables: chats (remove public column)

-- Remove the public column from chats table
alter table public.chats drop column if exists public;

-- Remove any indexes related to public chats
drop index if exists idx_chats_public;
drop index if exists idx_chats_public_updated_at; 