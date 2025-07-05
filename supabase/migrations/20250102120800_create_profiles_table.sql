-- Migration: Create profiles table
-- Purpose: Store user profile information for the news anchor bot
-- Date: 2025-01-02
-- Tables: profiles

-- Create profiles table to store user profile information
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique,
  display_name text,
  email text,
  persona_id uuid references public.personas(id) on delete set null,
  is_saved_to_supabase boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

comment on table public.profiles is 'Stores user profile information including display name, email, and persona preferences';

-- Create indexes for better performance
create index idx_profiles_user_id on public.profiles(user_id);
create index idx_profiles_persona_id on public.profiles(persona_id);
create index idx_profiles_email on public.profiles(email);

-- Enable Row Level Security (RLS) on profiles table
alter table public.profiles enable row level security;

-- Create RLS policies for profiles table
-- Allow anonymous users to select any profile (public access)
create policy "Profiles are viewable by everyone" 
on public.profiles 
for select 
to anon, authenticated 
using (true);

-- Allow anonymous users to insert new profiles
create policy "Profiles can be created by anyone" 
on public.profiles 
for insert 
to anon, authenticated 
with check (true);

-- Allow anonymous users to update any profile
create policy "Profiles can be updated by anyone" 
on public.profiles 
for update 
to anon, authenticated 
using (true) 
with check (true);

-- Allow anonymous users to delete any profile
create policy "Profiles can be deleted by anyone" 
on public.profiles 
for delete 
to anon, authenticated 
using (true);

-- Create trigger to automatically update updated_at column
create trigger handle_updated_at_trigger
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Enable realtime for profiles table
alter publication supabase_realtime add table public.profiles; 