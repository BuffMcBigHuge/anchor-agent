-- Migration: Enable Supabase Realtime
-- Purpose: Enable real-time subscriptions for the news anchor bot
-- Date: 2025-01-02
-- Tables: chats (realtime enabled)

-- Enable realtime for chats table to allow live updates
alter publication supabase_realtime add table public.chats;

-- Enable realtime for users table (optional, for user status updates)
alter publication supabase_realtime add table public.users;

-- Enable realtime for personas table (optional, for persona updates)
alter publication supabase_realtime add table public.personas; 