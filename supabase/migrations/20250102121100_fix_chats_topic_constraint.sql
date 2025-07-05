-- Migration: Fix chats table topic constraint
-- Purpose: Make topic column nullable since the application doesn't use it
-- Date: 2025-01-02
-- Tables: chats (modify topic column constraint)

-- Remove the NOT NULL constraint from topic column
-- This allows chats to be created without specifying a topic
alter table public.chats alter column topic drop not null;

-- Add a default value for topic to make it more user-friendly
alter table public.chats alter column topic set default 'General Discussion';

-- Update existing rows that might have null topics
update public.chats 
set topic = 'General Discussion' 
where topic is null;

-- Update table comment to reflect the change
comment on column public.chats.topic is 'Optional topic/category for the chat conversation, defaults to General Discussion';

-- Add index on topic for potential future filtering
create index if not exists idx_chats_topic on public.chats(topic); 