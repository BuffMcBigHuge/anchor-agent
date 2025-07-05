-- Migration: Create personas table
-- Purpose: Store persona information for the news anchor bot
-- Date: 2025-01-02
-- Tables: personas

-- Create personas table to store news anchor personalities
create table public.personas (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  voice_name text not null,
  description text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  image_url text
);

comment on table public.personas is 'Stores persona information for different news anchor personalities';

-- Enable Row Level Security (RLS) on personas table
alter table public.personas enable row level security;

-- Create RLS policies for personas table
-- Allow anonymous users to select any persona (public access)
create policy "Personas are viewable by everyone" 
on public.personas 
for select 
to anon, authenticated 
using (true);

-- Allow anonymous users to insert new personas
create policy "Personas can be created by anyone" 
on public.personas 
for insert 
to anon, authenticated 
with check (true);

-- Allow anonymous users to update any persona
create policy "Personas can be updated by anyone" 
on public.personas 
for update 
to anon, authenticated 
using (true) 
with check (true);

-- Allow anonymous users to delete any persona
create policy "Personas can be deleted by anyone" 
on public.personas 
for delete 
to anon, authenticated 
using (true);

-- Create trigger to automatically update updated_at column
create trigger handle_updated_at_trigger
  before update on public.personas
  for each row
  execute function public.handle_updated_at(); 