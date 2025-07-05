-- Migration: Add tone field to personas table
-- Purpose: Add the missing tone field that is referenced in personas.json and sync script
-- Date: 2025-01-02
-- Tables: personas

-- Add tone column to personas table
alter table public.personas 
add column tone text;

comment on column public.personas.tone is 'Describes the vocal tone and delivery style of the persona'; 