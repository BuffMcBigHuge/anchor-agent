const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.development') });

const { createClient } = require('@supabase/supabase-js');

class DatabaseService {
  constructor() {
    this.PERSONAS_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
    this.personasCache = null;
    this.lastPersonasCacheTime = null;
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  // Helper function to get personas from database with caching
  async getPersonas() {
    const now = Date.now();
    
    // Return cached personas if still fresh
    if (this.personasCache && (now - this.lastPersonasCacheTime) < this.PERSONAS_CACHE_TTL) {
      return this.personasCache;
    }
    
    try {
      const { data: personas, error } = await this.supabase
        .from('personas')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      // Cache the results
      this.personasCache = personas || [];
      this.lastPersonasCacheTime = now;
      
      return this.personasCache;
    } catch (error) {
      console.error('Error fetching personas from database:', error);
      
      // Return cached data if available, otherwise empty array
      return this.personasCache || [];
    }
  }

  // Helper function to get persona by ID or name
  async getPersonaById(personaId) {
    try {
      const personas = await this.getPersonas();
      return personas.find(p => p.id === personaId);
    } catch (error) {
      console.error('Error getting persona by ID:', error);
      return null;
    }
  }

  async getPersonaByName(personaName) {
    try {
      const personas = await this.getPersonas();
      return personas.find(p => p.name === personaName);
    } catch (error) {
      console.error('Error getting persona by name:', error);
      return null;
    }
  }

  // Helper function to ensure user exists in database
  async ensureUserExists(uid) {
    // This function is no longer needed since we use Supabase auth.users
    // The user will exist if they're authenticated
    return { id: uid };
  }

  // Helper function to get chat history for context (returns raw messages for AI processing)
  async getChatHistory(uid, chatId = null) {
    try {
      if (chatId) {
        // Get specific chat messages
        const { data: chat, error } = await this.supabase
          .from('chats')
          .select('messages')
          .eq('user_id', uid)
          .eq('id', chatId)
          .single();

        if (error) throw error;
        
        // Return the raw messages array from the specific chat, or empty array if no messages
        // NOTE: This method is used for AI context, so we don't sign URLs here
        return chat?.messages || [];
      } else {
        // This case is for when we need all chats (like for chat list), not for conversation context
        const { data: chats, error } = await this.supabase
          .from('chats')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return chats || [];
      }
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  // Helper function to get specific chat (returns S3 keys, client will request signed URLs as needed)
  async getChat(uid, chatId) {
    try {
      const { data: chat, error } = await this.supabase
        .from('chats')
        .select(`
          *,
          personas (
            id,
            name,
            voice_name
          )
        `)
        .eq('user_id', uid)
        .eq('id', chatId)
        .single();

      if (error) throw error;
      return chat;
    } catch (error) {
      console.error('Error getting chat:', error);
      return null;
    }
  }



  // Helper function to save conversation to database
  async saveConversation(uid, chatId, userMessage, responseText, selectedPersona, audioUrl = null, userAudioUrl = null, videoUrl = null) {
    try {
      const newMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
        audioUrl: userAudioUrl // Add user audio URL support
      };

      const assistantMessage = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
        persona: selectedPersona.name,
        personaId: selectedPersona.id,
        audioUrl: audioUrl,
        videoUrl: videoUrl
      };

      // Check if chat exists first
      const { data: existingChat, error: selectError } = await this.supabase
        .from('chats')
        .select('messages, persona_id')
        .eq('id', chatId)
        .eq('user_id', uid)
        .maybeSingle(); // Use maybeSingle to avoid error when no rows found

      if (selectError) throw selectError;

      if (existingChat) {
        // Update existing chat
        const updatedMessages = [
          ...(existingChat.messages || []),
          newMessage,
          assistantMessage
        ];

        const { data: updatedChat, error: updateError } = await this.supabase
          .from('chats')
          .update({ 
            messages: updatedMessages,
            updated_at: new Date().toISOString()
          })
          .eq('id', chatId)
          .eq('user_id', uid)
          .select()
          .single();

        if (updateError) throw updateError;
        return updatedChat;
      } else {
        // Create new chat with specific chatId
        const { data: newChat, error: insertError } = await this.supabase
          .from('chats')
          .insert({
            id: chatId, // Use the provided UUID as the chat ID
            user_id: uid,
            persona_id: selectedPersona.id, // Store the persona ID
            title: `Chat with ${selectedPersona.name}`,
            messages: [newMessage, assistantMessage]
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newChat;
      }
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      // Continue with response even if DB save fails
      return null;
    }
  }





  // Helper function to save profile to database
  async saveProfile(uid, displayName, email, personaId) {
    try {
      // Ensure user exists first
      await this.ensureUserExists(uid);

      // Check if profile already exists
      const { data: existingProfile, error: selectError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (selectError) throw selectError;

      const profileData = {
        user_id: uid,
        display_name: displayName,
        email,
        persona_id: personaId,
        is_saved_to_supabase: true,
        updated_at: new Date().toISOString()
      };

      if (existingProfile) {
        // Update existing profile
        const { data: updatedProfile, error: updateError } = await this.supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', uid)
          .select('*, personas(id, name, voice_name)')
          .single();

        if (updateError) throw updateError;
        return updatedProfile;
      } else {
        // Create new profile
        const { data: newProfile, error: insertError } = await this.supabase
          .from('profiles')
          .insert(profileData)
          .select('*, personas(id, name, voice_name)')
          .single();

        if (insertError) throw insertError;
        return newProfile;
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  }

  // Helper function to get profile from database
  async getProfile(uid) {
    try {
      const { data: profile, error } = await this.supabase
        .from('profiles')
        .select('*, personas(id, name, voice_name)')
        .eq('user_id', uid)
        .maybeSingle();

      if (error) throw error;
      return profile;
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }

  // Helper function to delete profile from database
  async deleteProfile(uid) {
    try {
      const { data: deletedProfile, error } = await this.supabase
        .from('profiles')
        .delete()
        .eq('user_id', uid)
        .select()
        .maybeSingle();

      if (error) throw error;
      return deletedProfile;
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  }

  // Getter for accessing the supabase client directly if needed
  get client() {
    return this.supabase;
  }
}

// Create and export a singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;