-- Migration: Create chats table
-- Purpose: Store chat conversations for the news anchor bot
-- Date: 2025-01-02
-- Tables: chats
-- Dependencies: users, personas

-- Create chats table to store news anchor conversations
create table public.chats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  messages jsonb default '[]'::jsonb not null,
  title text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  persona_id uuid references public.personas(id) on delete set null
);

comment on table public.chats is 'Stores chat conversations between users and news anchor personas';

-- Create indexes for better performance
create index idx_chats_user_id on public.chats(user_id);
create index idx_chats_persona_id on public.chats(persona_id);
create index idx_chats_created_at on public.chats(created_at desc);

-- Enable Row Level Security (RLS) on chats table
alter table public.chats enable row level security;

-- Create RLS policies for chats table
-- Allow anonymous users to select any chat (public access)
create policy "Chats are viewable by everyone" 
on public.chats 
for select 
to anon, authenticated 
using (true);

-- Allow anonymous users to insert new chats
create policy "Chats can be created by anyone" 
on public.chats 
for insert 
to anon, authenticated 
with check (true);

-- Allow anonymous users to update any chat
create policy "Chats can be updated by anyone" 
on public.chats 
for update 
to anon, authenticated 
using (true) 
with check (true);

-- Allow anonymous users to delete any chat
create policy "Chats can be deleted by anyone" 
on public.chats 
for delete 
to anon, authenticated 
using (true);

-- Create trigger to automatically update updated_at column
create trigger handle_updated_at_trigger
  before update on public.chats
  for each row
  execute function public.handle_updated_at(); 