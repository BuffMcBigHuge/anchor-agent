-- Migration: Create users table
-- Purpose: Store user information for the news anchor bot
-- Date: 2025-01-02
-- Tables: users

-- Create users table to store basic user information
create table public.users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  image_url text
);

comment on table public.users is 'Stores user information for the news anchor bot system';

-- Enable Row Level Security (RLS) on users table
alter table public.users enable row level security;

-- Create RLS policies for users table
-- Allow anonymous users to select any user (public access)
create policy "Users are viewable by everyone" 
on public.users 
for select 
to anon, authenticated 
using (true);

-- Allow anonymous users to insert new users
create policy "Users can be created by anyone" 
on public.users 
for insert 
to anon, authenticated 
with check (true);

-- Allow anonymous users to update any user
create policy "Users can be updated by anyone" 
on public.users 
for update 
to anon, authenticated 
using (true) 
with check (true);

-- Allow anonymous users to delete any user
create policy "Users can be deleted by anyone" 
on public.users 
for delete 
to anon, authenticated 
using (true);

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Update the updated_at column on row modification
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger to automatically update updated_at column
create trigger handle_updated_at_trigger
  before update on public.users
  for each row
  execute function public.handle_updated_at(); 