-- Migration: Update chats table structure
-- Purpose: Modify chats table to better match message array format
-- Date: 2025-01-02
-- Tables: chats (structure update)

-- Add current_persona_name column to track the active persona name
alter table public.chats 
add column current_persona_name text;

-- Add index for current_persona_name for better performance
create index idx_chats_current_persona_name on public.chats(current_persona_name);

-- Update the comment to reflect the new message structure
comment on table public.chats is 'Stores chat conversations between users and news anchor personas. Messages array contains objects with role, content, audioUrl, timestamp, persona, and personaId fields';

-- Add a comment explaining the expected message structure
comment on column public.chats.messages is 'JSONB array of message objects. Each message should have: role (user/assistant), content (text), audioUrl (nullable), timestamp (ISO string), persona (name, for assistant messages), personaId (UUID, for assistant messages)';

-- Create a function to validate message structure (optional but helpful)
create or replace function public.validate_message_structure(messages jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  message jsonb;
begin
  -- Check if messages is an array
  if jsonb_typeof(messages) != 'array' then
    return false;
  end if;
  
  -- Validate each message in the array
  for message in select jsonb_array_elements(messages)
  loop
    -- Check required fields exist
    if not (message ? 'role' and message ? 'content' and message ? 'timestamp') then
      return false;
    end if;
    
    -- Check role is either 'user' or 'assistant'
    if not (message->>'role' in ('user', 'assistant')) then
      return false;
    end if;
    
    -- If role is assistant, check for persona and personaId
    if message->>'role' = 'assistant' then
      if not (message ? 'persona' and message ? 'personaId') then
        return false;
      end if;
    end if;
  end loop;
  
  return true;
end;
$$;

-- Add a check constraint to ensure messages follow the expected structure
alter table public.chats 
add constraint chk_messages_structure 
check (public.validate_message_structure(messages)); 