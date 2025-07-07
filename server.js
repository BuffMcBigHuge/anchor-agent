console.log('🔧 Loading environment configuration...');
require('dotenv').config({ path: '.env.development' });

console.log('📦 Loading core dependencies...');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const db = require('./utils/db');
const ai = require('./utils/generate');
const s3Service = require('./utils/s3');
const brightdataService = require('./utils/brightdata');
const videoGenerationService = require('./utils/videoGeneration');
const {
  saveAudioFile,
  saveMultiSpeakerAudio,
} = require('./utils/helpers');

// Utility function to remove square brackets and their content from text
function cleanResponseText(text) {
  if (!text) return text;
  // Remove square brackets and everything inside them, including any leading/trailing spaces
  return text.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

// Helper function to sign media URLs in messages
async function signMediaUrlsInMessages(messages) {
  return await Promise.all(messages.map(async (message) => {
    const signedMessage = { ...message };

    try {
      // Sign audio URL if present and it's an S3 key (not already a signed URL)
      if (message.audioUrl && typeof message.audioUrl === 'string') {
        // Check if it's an S3 key (no https:// and no query parameters)
        if (!message.audioUrl.startsWith('http') && !message.audioUrl.includes('?')) {
          signedMessage.audioUrl = await s3Service.getSignedUrl(message.audioUrl, 3600);
          console.log('✅ Signed audio URL for message');
        }
      }

      // Sign video URL if present and it's an S3 key (not already a signed URL)
      if (message.videoUrl && typeof message.videoUrl === 'string') {
        // Check if it's an S3 key (no https:// and no query parameters)
        if (!message.videoUrl.startsWith('http') && !message.videoUrl.includes('?')) {
          signedMessage.videoUrl = await s3Service.getSignedUrl(message.videoUrl, 3600);
          console.log('✅ Signed video URL for message');
        }
      }
    } catch (signError) {
      console.error('❌ Error signing media URLs for message:', signError);
      // Keep original URLs if signing fails
    }

    return signedMessage;
  }));
}

console.log('🚀 Initializing Express app...');
const app = express();
const port = process.env.PORT || 3001;

console.log('🔧 Setting up middleware...');
app.use(cors());
// Increase payload size limits for audio uploads (50MB limit)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure Helmet with custom CSP for audio functionality
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'", 
        "http://*.replit.dev", 
        "https://*.replit.dev", 
        "http://*.spock.replit.dev", 
        "https://*.spock.replit.dev",
        "http://localhost:*",
        "https://localhost:*",
        "https://*.amazonaws.com",
        "wss://*.supabase.co",
        "https://*.supabase.co"
      ],
      mediaSrc: [
        "'self'", 
        "blob:",
        "http://*.replit.dev", 
        "https://*.replit.dev", 
        "http://*.spock.replit.dev", 
        "https://*.spock.replit.dev",
        "http://localhost:*",
        "https://localhost:*",
        "https://*.amazonaws.com",
        "https://*.supabase.co"
      ],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.supabase.co", "https://*.amazonaws.com"],
      fontSrc: ["'self'", "data:"],
      workerSrc: ["'self'", "blob:"]
    }
  }
}));

// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
  console.log('📁 Serving static files from frontend/dist...');
  app.use(express.static(path.join(__dirname, 'frontend/dist')));
}

console.log('✅ Middleware configured');

// Ensure audio_files directory exists
const audioFilesDir = path.join(__dirname, 'audio_files');
if (!fs.existsSync(audioFilesDir)) {
  fs.mkdirSync(audioFilesDir, { recursive: true });
}

// Legacy endpoint to serve local audio files (kept for migration period)
app.get('/api/audio/:uid/:chatId/:filename', (req, res) => {
  console.log('🎵 [GET] /api/audio/:uid/:chatId/:filename - Serving local audio file');
  console.log('📋 Parameters:', { uid: req.params.uid, chatId: req.params.chatId, filename: req.params.filename });
  
  try {
    const { uid, chatId, filename } = req.params;
    const filePath = path.join(audioFilesDir, uid, chatId, filename);
    
    // Check if file exists locally
    if (!fs.existsSync(filePath)) {
      console.log('❌ Local audio file not found:', filePath);
      return res.status(404).json({ 
        error: 'Audio file not found locally. New audio files are served via S3 signed URLs.' 
      });
    }
    
    // All files are PCM from Google
    const contentType = 'audio/L16';
    
    // Set headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.sendFile(filePath);
    console.log('✅ Successfully served local audio file:', filename);
  } catch (error) {
    console.error('❌ Error serving audio file:', error);
    res.status(500).json({ error: 'Failed to serve audio file' });
  }
});

// Proxy endpoint to serve S3 audio files (solves CORS issues)
app.get(/^\/api\/audio\/s3\/(.+)$/, async (req, res) => {
  console.log('🎵 [GET] /api/audio/s3/* - Proxying S3 audio file');
  console.log('📋 S3 Key:', req.params[0]);
  
  try {
    const s3Key = req.params[0];
    
    console.log('🔗 Proxying S3 audio file for key:', s3Key);
    
    // Validate S3 key format (should be uid/chatid/filename.pcm)
    const keyParts = s3Key.split('/');
    if (keyParts.length !== 3 || !keyParts[2].endsWith('.pcm')) {
      console.log('❌ Invalid S3 key format:', s3Key);
      return res.status(400).json({ error: 'Invalid S3 key format' });
    }
    
    // Generate signed URL with 1 hour expiration
    const signedUrl = await s3Service.getSignedUrl(s3Key, 3600);
    
    console.log('🔗 Fetching audio from S3:', s3Key);
    
    // Fetch the audio file from S3
    const response = await fetch(signedUrl);
    
    if (!response.ok) {
      console.error('❌ Failed to fetch from S3:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch audio from S3: ${response.status} ${response.statusText}` 
      });
    }
    
    // Set appropriate headers for PCM audio
    res.setHeader('Content-Type', 'audio/L16');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Stream the audio data to the client
    response.body.pipe(res);
    
    console.log('✅ Successfully proxied S3 audio file:', s3Key);
    
  } catch (error) {
    console.error('❌ Error proxying S3 audio file:', error);
    res.status(500).json({ error: 'Failed to proxy audio file from S3' });
  }
});

// New endpoint to generate signed URLs for S3 keys on demand (kept for compatibility)
app.get('/api/audio/sign/:s3Key', async (req, res) => {
  console.log('🔗 [GET] /api/audio/sign/:s3Key - Generating signed URL');
  console.log('📋 S3 Key:', req.params.s3Key);
  
  try {
    const s3Key = req.params.s3Key;
    
    console.log('🔗 Generating signed URL for S3 key:', s3Key);
    
    // Validate S3 key format (should be uid/chatid/filename.pcm)
    const keyParts = s3Key.split('/');
    if (keyParts.length !== 3 || !keyParts[2].endsWith('.pcm')) {
      console.log('❌ Invalid S3 key format:', s3Key);
      return res.status(400).json({ error: 'Invalid S3 key format' });
    }
    
    // Generate signed URL with 1 hour expiration
    const signedUrl = await s3Service.getSignedUrl(s3Key, 3600);
    
    console.log('✅ Generated signed URL for:', s3Key);
    
    res.json({ signedUrl });
  } catch (error) {
    console.error('❌ Error generating signed URL:', error);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

// New endpoint to get personas list
app.get('/api/personas', async (req, res) => {
  console.log('🎭 [GET] /api/personas - Fetching personas list');
  
  try {
    const personas = await db.getPersonas();
    console.log(`✅ Successfully fetched ${personas.length} personas`);
    
    // Generate signed URLs for persona images
    const personasWithSignedUrls = await Promise.all(personas.map(async (persona) => {
      if (persona.image_url) {
        try {
          // Extract S3 key from the full URL
          // URL format: https://audio-chat-bymarco.s3.us-east-1.amazonaws.com/personas/filename.webp
          const url = new URL(persona.image_url);
          const s3Key = url.pathname.substring(1); // Remove leading slash
          
          // Generate signed URL with 24 hour expiration (longer for images)
          const signedUrl = await s3Service.getSignedUrl(s3Key, 86400);
          
          return {
            ...persona,
            image_url: signedUrl
          };
        } catch (error) {
          console.error(`❌ Error generating signed URL for persona ${persona.name}:`, error);
          // Return persona without image_url if signing fails
          return {
            ...persona,
            image_url: null
          };
        }
      }
      return persona;
    }));
    
    res.json({ personas: personasWithSignedUrls });
  } catch (error) {
    console.error('❌ Error loading personas:', error);
    res.status(500).json({ error: 'Failed to load personas' });
  }
});

// New endpoint to get supported news locations
app.get('/api/locations', async (req, res) => {
  console.log('📍 [GET] /api/locations - Fetching supported news locations');
  
  try {
    const locations = brightdataService.getSupportedLocations();
    console.log(`✅ Successfully fetched ${locations.length} supported locations`);
    res.json({ locations });
  } catch (error) {
    console.error('❌ Error loading locations:', error);
    res.status(500).json({ error: 'Failed to load locations' });
  }
});

// Profile endpoints
// Save profile to database
app.post('/api/profile/save', async (req, res) => {
  console.log('👤 [POST] /api/profile/save - Saving user profile');
  console.log('📋 Request body:', { 
    uid: req.body.uid, 
    displayName: req.body.displayName, 
    email: req.body.email ? '[REDACTED]' : undefined,
    personaId: req.body.personaId 
  });
  
  try {
    const { uid, displayName, email, personaId } = req.body;

    console.log('🔄 Saving profile for user:', uid);

    // Validate required fields
    if (!uid) {
      console.log('❌ UID is required');
      return res.status(400).json({ error: 'UID is required' });
    }

    if (!email || !email.trim()) {
      console.log('❌ Email is required');
      return res.status(400).json({ error: 'Email is required to save profile' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      console.log('❌ Invalid email format');
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate persona_id if provided
    if (personaId) {
      console.log('🔍 Validating persona ID:', personaId);
      const persona = await db.getPersonaById(personaId);
      if (!persona) {
        console.log('❌ Invalid persona ID:', personaId);
        return res.status(400).json({ error: 'Invalid persona ID' });
      }
      console.log('✅ Persona validation passed:', persona.name);
    }

    // Save profile to database
    const savedProfile = await db.saveProfile(uid, displayName, email.trim(), personaId);

    console.log('✅ Profile saved successfully for user:', uid);

    // Return transformed profile data matching frontend expectations
    res.json({
      success: true,
      profile: {
        uid: savedProfile.uid,
        displayName: savedProfile.display_name,
        email: savedProfile.email,
        personaId: savedProfile.persona_id,
        persona: savedProfile.personas ? {
          id: savedProfile.personas.id,
          name: savedProfile.personas.name,
          voiceName: savedProfile.personas.voice_name
        } : null,
        isSavedToSupabase: savedProfile.is_saved_to_supabase,
        savedAt: savedProfile.updated_at
      }
    });
  } catch (error) {
    console.error('❌ Error saving profile:', error);
    res.status(500).json({ error: 'Failed to save profile', details: error.message });
  }
});

// Get profile from database
app.get('/api/profile/:uid', async (req, res) => {
  console.log('👤 [GET] /api/profile/:uid - Loading user profile');
  console.log('📋 UID:', req.params.uid);
  
  try {
    const { uid } = req.params;

    console.log('🔍 Loading profile for user:', uid);

    if (!uid) {
      console.log('❌ UID is required');
      return res.status(400).json({ error: 'UID is required' });
    }

    // Get profile from database
    const profile = await db.getProfile(uid);

    if (!profile) {
      console.log('📭 No profile found for user:', uid);
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log('✅ Profile loaded successfully for user:', uid);
    console.log('📊 Profile details:', {
      displayName: profile.display_name,
      email: profile.email ? '[REDACTED]' : null,
      personaId: profile.persona_id,
      personaName: profile.personas?.name
    });

    // Return transformed profile data matching frontend expectations
    res.json({
      profile: {
        uid: profile.uid,
        displayName: profile.display_name,
        email: profile.email,
        personaId: profile.persona_id,
        persona: profile.personas ? {
          id: profile.personas.id,
          name: profile.personas.name,
          voiceName: profile.personas.voice_name
        } : null,
        isSavedToSupabase: profile.is_saved_to_supabase,
        savedAt: profile.updated_at
      }
    });
  } catch (error) {
    console.error('❌ Error loading profile:', error);
    res.status(500).json({ error: 'Failed to load profile', details: error.message });
  }
});

// Delete profile from database
app.delete('/api/profile/:uid', async (req, res) => {
  console.log('👤 [DELETE] /api/profile/:uid - Deleting user profile');
  console.log('📋 UID:', req.params.uid);
  
  try {
    const { uid } = req.params;

    console.log('🗑️ Deleting profile for user:', uid);

    if (!uid) {
      console.log('❌ UID is required');
      return res.status(400).json({ error: 'UID is required' });
    }

    // Delete profile from database
    const deletedProfile = await db.deleteProfile(uid);

    if (!deletedProfile) {
      console.log('📭 No profile found to delete for user:', uid);
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log('✅ Profile deleted successfully for user:', uid);

    res.json({
      success: true,
      message: 'Profile deleted successfully',
      deletedProfile: {
        uid: deletedProfile.uid,
        displayName: deletedProfile.display_name,
        email: deletedProfile.email
      }
    });
  } catch (error) {
    console.error('❌ Error deleting profile:', error);
    res.status(500).json({ error: 'Failed to delete profile', details: error.message });
  }
});

// Endpoint to get user's chat history
app.get('/api/chats/:uid', async (req, res) => {
  console.log('💬 [GET] /api/chats/:uid - Fetching user chat history');
  console.log('📋 UID:', req.params.uid);
  
  try {
    const { uid } = req.params;
    
    console.log('🔍 Fetching chat history for user:', uid);
    console.log('🔍 UID type:', typeof uid, 'Length:', uid.length);
    
    // Ensure user exists (currently a no-op but kept for compatibility)
    await db.ensureUserExists(uid);
    
    // First, let's check if there are any chats in the database at all
    console.log('🔍 Checking total chats in database...');
    const { data: allChats, error: allChatsError } = await db.client
      .from('chats')
      .select('id, user_id, title, created_at')
      .limit(10);
    
    if (allChatsError) {
      console.error('❌ Error checking all chats:', allChatsError);
    } else {
      console.log('📊 Total chats in database (sample):', allChats?.length || 0);
      if (allChats && allChats.length > 0) {
        // console.log('📊 Sample chat user_ids:', allChats.map(c => ({ id: c.id, user_id: c.user_id, title: c.title })));
      }
    }
    
    // Get chat history with persona information
    console.log('🔍 Querying chats for user_id:', uid);
    const { data: chats, error } = await db.client
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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
    
    console.log(`✅ Successfully fetched ${chats?.length || 0} chats for user:`, uid);
    
    if (chats && chats.length > 0) {
      console.log(`📊 Found ${chats.length} chats:`);
    }
    
    res.json({ 
      chats: (chats || []).map(chat => ({
        id: chat.id,
        title: chat.title || 'Untitled Chat',
        created_at: chat.created_at,
        updated_at: chat.updated_at,
        messageCount: chat.messages ? chat.messages.length : 0,
        persona: chat.personas ? {
          id: chat.personas.id,
          name: chat.personas.name,
          voiceName: chat.personas.voice_name
        } : null
      }))
    });
  } catch (error) {
    console.error('❌ Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history', details: error.message });
  }
});

// Endpoint to get specific chat with full messages (user's own chat)
// NOTE: This must come AFTER the public chat route to avoid routing conflicts
app.get('/api/chats/:uid/:chatId', async (req, res) => {
  console.log('💬 [GET] /api/chats/:uid/:chatId - Fetching specific user chat');
  console.log('📋 Parameters:', { uid: req.params.uid, chatId: req.params.chatId });
  
  try {
    const { uid, chatId } = req.params;
    
    console.log('🔍 Fetching chat for user:', uid, 'chat ID:', chatId);
    
    // Get chat with S3 keys (no signing here)
    const chat = await db.getChat(uid, chatId);

    if (!chat) {
      console.log('📭 Chat not found for user:', uid, 'chat ID:', chatId);
      return res.status(404).json({ error: 'Chat not found' });
    }

    console.log('✅ Successfully fetched chat:', { id: chat.id, title: chat.title, messageCount: chat.messages?.length || 0 });

    // Clean the chat.messages content by removing square brackets and their content
    chat.messages = chat.messages.map(message => ({
      ...message,
      content: cleanResponseText(message.content)
    }));

    // Generate signed URLs for all media files in messages
    console.log('🔗 Generating signed URLs for media files in chat messages...');
    chat.messages = await signMediaUrlsInMessages(chat.messages);
    console.log('✅ Signed URLs generated for chat messages');

    // Transform the response to include persona in a more accessible format
    const response = {
      ...chat,
      persona: chat.personas ? {
        id: chat.personas.id,
        name: chat.personas.name,
        tone: chat.personas.tone,
        voiceName: chat.personas.voice_name
      } : null
    };
    
    // Remove the nested personas object since we've flattened it
    delete response.personas;

    res.json({ chat: response });
  } catch (error) {
    console.error('❌ Error getting specific chat:', error);
    res.status(500).json({ error: 'Failed to get chat', details: error.message });
  }
});

// Endpoint to delete a chat
app.delete('/api/chats/:uid/:chatId', async (req, res) => {
  console.log('💬 [DELETE] /api/chats/:uid/:chatId - Deleting user chat');
  console.log('📋 Parameters:', { uid: req.params.uid, chatId: req.params.chatId });
  
  try {
    const { uid, chatId } = req.params;
    
    console.log('🗑️ Deleting chat for user:', uid, 'chat ID:', chatId);
    
    const { error } = await db.client
      .from('chats')
      .delete()
      .eq('user_id', uid)
      .eq('id', chatId);

    if (error) throw error;

    console.log('✅ Successfully deleted chat:', chatId);

    res.json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat', details: error.message });
  }
});

// Text chat endpoint
app.post('/api/chat/text', async (req, res) => {
  console.log('💬 [POST] /api/chat/text - Processing text chat message');
  console.log('📋 Request details:', { 
    messageLength: req.body.message?.length || 0,
    personaName: req.body.personaName,
    personaId: req.body.personaId,
    uid: req.body.uid,
    chatId: req.body.chatId,
    locations: req.body.locations,
    videoEnabled: req.body.videoEnabled
  });
  
  try {
    const { message, personaName, personaId, uid, chatId, locations, videoEnabled = false } = req.body;

    console.log('📨 Received text message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    console.log('🎭 Selected persona:', personaName || personaId);
    console.log('👤 User UID:', uid);
    console.log('💬 Chat ID:', chatId);
    console.log('📍 News locations:', locations);
    console.log('🎬 Video generation enabled:', videoEnabled);

    // User authentication is handled by Supabase auth - no need to ensure user exists

    // Find the selected persona by ID or name, or use default
    let selectedPersona = null;
    if (personaId) {
      selectedPersona = await db.getPersonaById(personaId);
    } else if (personaName) {
      selectedPersona = await db.getPersonaByName(personaName);
    }
    
    // If no persona found or if chatId exists, try to get from chat's default persona
    if (!selectedPersona && chatId) {
      const { data: chat, error } = await db.client
        .from('chats')
        .select('persona_id, personas(id, name, tone, voice_name)')
        .eq('id', chatId)
        .eq('user_id', uid)
        .single();
      
      if (!error && chat?.personas) {
        selectedPersona = chat.personas;
      }
    }
    
    // Fallback to first available persona if none found
    if (!selectedPersona) {
      const personas = await db.getPersonas();
      selectedPersona = personas[0];
    }
    
    if (!selectedPersona) {
      throw new Error('No personas available. Please run persona sync first.');
    }
    
    console.log('🎤 Using voice:', selectedPersona.voice_name);

    // Get chat history for context - only if continuing an existing chat
    const chatHistory = chatId ? await db.getChatHistory(uid, chatId) : [];
    console.log('📚 Chat history context:', chatHistory.length, 'previous messages');

    // Validate locations if provided
    const validLocations = [];
    if (locations && Array.isArray(locations)) {
      for (const location of locations) {
        if (brightdataService.isLocationSupported(location)) {
          validLocations.push(location);
        } else {
          console.warn(`⚠️ Unsupported location: ${location}`);
        }
      }
    }

    // Generate AI response with news context
    console.log('🤖 Generating AI response...');
    console.log('🧑 About to call generateAIResponse with selectedPersona:', JSON.stringify(selectedPersona, null, 2));
    const rawResponseText = await ai.generateAIResponse(message, selectedPersona, chatHistory, validLocations);
    console.log('✅ Generated response length:', rawResponseText.length);

    // Generate chatId if not provided (new chat)
    const currentChatId = chatId || randomUUID();

    // Check if user selected their own persona for multi-user mode
    const isMultiUserMode = selectedPersona.name === 'User';
    let audioUrl = null;
    let userAudioUrl = null;
    let videoUrl = null;

    try {
      console.log('🔊 Attempting to generate audio...');
      
      if (isMultiUserMode) {
        console.log('🎭 Multi-user mode detected, generating multi-speaker audio');
        
        // Find a default assistant persona for the conversation
        const personas = await db.getPersonas();
        const assistantPersona = personas.find(p => p.name !== 'User') || personas[0];
        
        // Generate multi-speaker audio
        const { audioData, responseMimeType } = await ai.generateMultiSpeakerAudio(
          message, 
          rawResponseText, 
          selectedPersona, 
          assistantPersona
        );
        
        // Save multi-speaker audio as separate files
        const { userAudioUrl: userUrl, assistantAudioUrl: assistantUrl } = await saveMultiSpeakerAudio(
          audioData, 
          responseMimeType, 
          uid, 
          currentChatId, 
          req
        );
        
        userAudioUrl = userUrl;
        audioUrl = assistantUrl;
        console.log('✅ Multi-speaker audio generation successful');
      } else {
        // Standard single-speaker mode (assistant only)
        const { audioData, responseMimeType } = await ai.generateAudio(rawResponseText, selectedPersona);
        audioUrl = await saveAudioFile(audioData, responseMimeType, uid, currentChatId, req);
        console.log('✅ Single-speaker audio generation successful');
      }
    } catch (audioError) {
      console.warn('⚠️ Audio generation failed, continuing with text-only response:', audioError.message);
      // Continue without audio - this is graceful degradation
    }

    // Generate video if enabled and audio was successfully generated
    if (videoEnabled && audioUrl) {
      try {
        console.log('🎬 Video generation enabled, starting video creation...');
        
        // Get the audio data from S3 for video generation
        const audioS3Data = await s3Service.getSignedUrl(audioUrl);
        const audioResponse = await fetch(audioS3Data);
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
        
        // Get persona image for video generation
        let personaImageBuffer = null;
        if (selectedPersona.image_url) {
          try {
            console.log('🖼️ Generating signed URL for persona image...');
            
            // Extract S3 key from the full URL (same logic as /api/personas endpoint)
            // URL format: https://audio-chat-bymarco.s3.us-east-1.amazonaws.com/personas/filename.webp
            const url = new URL(selectedPersona.image_url);
            const s3Key = url.pathname.substring(1); // Remove leading slash
            console.log('🔑 S3 Key:', s3Key);
            
            // Generate signed URL with 1 hour expiration
            const signedImageUrl = await s3Service.getSignedUrl(s3Key, 3600);
            console.log('🖼️ Fetching persona image from signed URL');
            
            const imageResponse = await fetch(signedImageUrl);
            console.log('📊 Image response status:', imageResponse.status);
            console.log('📊 Image response content-type:', imageResponse.headers.get('content-type'));
            
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
            }
            
            const arrayBuffer = await imageResponse.arrayBuffer();
            personaImageBuffer = Buffer.from(arrayBuffer);
            console.log('📏 Image buffer size:', personaImageBuffer.length, 'bytes');
            
            // Validate that we have a reasonable image size
            if (personaImageBuffer.length < 1000) {
              console.warn('⚠️ Image buffer seems too small:', personaImageBuffer.length, 'bytes');
              throw new Error('Image buffer too small, likely corrupted');
            }
            
          } catch (imageError) {
            console.error('❌ Error fetching persona image:', imageError);
            console.log('⚠️ Continuing without persona image due to fetch error');
            personaImageBuffer = null;
          }
        } else {
          // Use a default image if no persona image is available
          console.log('⚠️ No persona image available, using default');
          // TODO: Add default image handling
        }
        
        if (personaImageBuffer) {
          // Convert PCM audio to WAV for ComfyUI
          const wavAudioBuffer = videoGenerationService.convertPCMToWAV(audioBuffer);
          
          // Generate video using ComfyUI workflow
          videoUrl = await videoGenerationService.generateVideo(
            wavAudioBuffer,
            personaImageBuffer,
            uid,
            currentChatId
          );
          
          console.log('✅ Video generation successful:', videoUrl);
        }
      } catch (videoError) {
        console.warn('⚠️ Video generation failed, continuing without video:', videoError.message);
        // Continue without video - this is graceful degradation
      }
    }

    // Save conversation to database with audio and video URLs (null if generation failed)
    console.log('💾 Saving conversation to database...');
    const savedChat = await db.saveConversation(uid, currentChatId, message, rawResponseText, selectedPersona, audioUrl, userAudioUrl, videoUrl);
    console.log('✅ Chat saved successfully:', savedChat?.id);

    // FOR UI: clean the response text of square brackets and their content
    const responseText = cleanResponseText(rawResponseText);
    
    console.log('🎉 Text chat processing completed successfully');
    
    // Generate signed URLs for frontend access
    let signedAudioUrl = null;
    let signedUserAudioUrl = null;
    let signedVideoUrl = null;

    try {
      // Generate signed URL for assistant audio
      if (audioUrl) {
        signedAudioUrl = await s3Service.getSignedUrl(audioUrl, 3600); // 1 hour expiry
      }

      // Generate signed URL for user audio (multi-speaker mode)
      if (userAudioUrl) {
        signedUserAudioUrl = await s3Service.getSignedUrl(userAudioUrl, 3600);
      }

      // Generate signed URL for video
      if (videoUrl) {
        signedVideoUrl = await s3Service.getSignedUrl(videoUrl, 3600);
        console.log('✅ Generated signed video URL for frontend');
      }
    } catch (signError) {
      console.error('❌ Error generating signed URLs:', signError);
      // Continue with response even if signing fails
    }

    // Return JSON response with signed URLs for frontend processing
    res.json({
      transcribedText: message, // For consistency with audio endpoint
      responseText,
      audioUrl: signedAudioUrl, // Signed URL to fetch assistant audio file
      userAudioUrl: signedUserAudioUrl, // Signed URL to fetch user audio file (null for single-speaker mode)
      videoUrl: signedVideoUrl, // Signed URL to fetch video file (null if video not enabled or failed)
      timestamp: new Date().toISOString(),
      chatId: savedChat?.id || currentChatId,
      isMultiUserMode // Flag to indicate multi-user mode
    });

  } catch (error) {
    console.error('❌ Error in text chat endpoint:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({ error: 'An error occurred processing your request', details: error.message });
  }
});

// Audio chat endpoint
app.post('/api/chat/audio', async (req, res) => {
  console.log('🎤 [POST] /api/chat/audio - Processing audio chat message');
  console.log('📋 Request details:', { 
    audioDataLength: req.body.message?.length || 0,
    personaName: req.body.personaName,
    personaId: req.body.personaId,
    uid: req.body.uid,
    chatId: req.body.chatId,
    locations: req.body.locations,
    videoEnabled: req.body.videoEnabled
  });
  
  try {
    const { message, personaName, personaId, uid, chatId, locations, videoEnabled = false } = req.body;

    console.log('🎵 Received audio data, length:', message.length);
    console.log('🎭 Selected persona:', personaName || personaId);
    console.log('👤 User UID:', uid);
    console.log('💬 Chat ID:', chatId);
    console.log('📍 News locations:', locations);
    console.log('🎬 Video generation enabled:', videoEnabled);

    // User authentication is handled by Supabase auth - no need to ensure user exists

    // Find the selected persona by ID or name, or use default
    let selectedPersona = null;
    if (personaId) {
      selectedPersona = await db.getPersonaById(personaId);
    } else if (personaName) {
      selectedPersona = await db.getPersonaByName(personaName);
    }
    
    // If no persona found or if chatId exists, try to get from chat's default persona
    if (!selectedPersona && chatId) {
      const { data: chat, error } = await db.client
        .from('chats')
        .select('persona_id, personas(id, name, tone, voice_name)')
        .eq('id', chatId)
        .eq('user_id', uid)
        .single();
      
      if (!error && chat?.personas) {
        selectedPersona = chat.personas;
      }
    }
    
    // Fallback to first available persona if none found
    if (!selectedPersona) {
      const personas = await db.getPersonas();
      selectedPersona = personas[0];
    }
    
    if (!selectedPersona) {
      throw new Error('No personas available. Please run persona sync first.');
    }
    
    console.log('🎤 Using voice:', selectedPersona.voice_name);

    // Get chat history for context - only if continuing an existing chat
    const chatHistory = chatId ? await db.getChatHistory(uid, chatId) : [];
    console.log('📚 Chat history context:', chatHistory.length, 'previous messages');

    // First convert speech to text using Gemini's audio understanding
    console.log('🎧 Transcribing audio to text...');
    const transcribedText = await ai.transcribeAudio(message, "audio/wav");
    console.log('✅ Transcribed text:', transcribedText.substring(0, 100) + (transcribedText.length > 100 ? '...' : ''));

    // Validate locations if provided
    const validLocations = [];
    if (locations && Array.isArray(locations)) {
      for (const location of locations) {
        if (brightdataService.isLocationSupported(location)) {
          validLocations.push(location);
        } else {
          console.warn(`⚠️ Unsupported location: ${location}`);
        }
      }
    }

    // Generate AI response with news context
    console.log('🤖 Generating AI response...');
    const rawResponseText = await ai.generateAIResponse(transcribedText, selectedPersona, chatHistory, validLocations);
    console.log('✅ Generated response length:', rawResponseText.length);

    // Generate chatId if not provided (new chat)
    const currentChatId = chatId || randomUUID();

    // Check if user selected their own persona for multi-user mode
    const isMultiUserMode = selectedPersona.name === 'User';
    let audioUrl = null;
    let userAudioUrl = null;
    let videoUrl = null;

    try {
      console.log('🔊 Attempting to generate audio...');
      
      if (isMultiUserMode) {
        console.log('🎭 Multi-user mode detected, generating multi-speaker audio');
        
        // Find a default assistant persona for the conversation
        const personas = await db.getPersonas();
        const assistantPersona = personas.find(p => p.name !== 'User') || personas[0];
        
        // Generate multi-speaker audio
        const { audioData, responseMimeType } = await ai.generateMultiSpeakerAudio(
          transcribedText, 
          rawResponseText, 
          selectedPersona, 
          assistantPersona
        );
        
        // Save multi-speaker audio as separate files
        const { userAudioUrl: userUrl, assistantAudioUrl: assistantUrl } = await saveMultiSpeakerAudio(
          audioData, 
          responseMimeType, 
          uid, 
          currentChatId, 
          req
        );
        
        userAudioUrl = userUrl;
        audioUrl = assistantUrl;
        console.log('✅ Multi-speaker audio generation successful');
      } else {
        // Standard single-speaker mode (assistant only)
        const { audioData, responseMimeType } = await ai.generateAudio(rawResponseText, selectedPersona);
        audioUrl = await saveAudioFile(audioData, responseMimeType, uid, currentChatId, req);
        console.log('✅ Single-speaker audio generation successful');
      }
    } catch (audioError) {
      console.warn('⚠️ Audio generation failed, continuing with text-only response:', audioError.message);
      // Continue without audio - this is graceful degradation
    }

    // Generate video if enabled and audio was successfully generated
    if (videoEnabled && audioUrl) {
      try {
        console.log('🎬 Video generation enabled, starting video creation...');
        
        // Get the audio data from S3 for video generation
        const audioS3Data = await s3Service.getSignedUrl(audioUrl);
        const audioResponse = await fetch(audioS3Data);
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
        
        // Get persona image for video generation
        let personaImageBuffer = null;
        if (selectedPersona.image_url) {
          try {
            console.log('🖼️ Generating signed URL for persona image...');
            
            // Extract S3 key from the full URL (same logic as /api/personas endpoint)
            // URL format: https://audio-chat-bymarco.s3.us-east-1.amazonaws.com/personas/filename.webp
            const url = new URL(selectedPersona.image_url);
            const s3Key = url.pathname.substring(1); // Remove leading slash
            console.log('🔑 S3 Key:', s3Key);
            
            // Generate signed URL with 1 hour expiration
            const signedImageUrl = await s3Service.getSignedUrl(s3Key, 3600);
            console.log('🖼️ Fetching persona image from signed URL');
            
            const imageResponse = await fetch(signedImageUrl);
            console.log('📊 Image response status:', imageResponse.status);
            console.log('📊 Image response content-type:', imageResponse.headers.get('content-type'));
            
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
            }
            
            const arrayBuffer = await imageResponse.arrayBuffer();
            personaImageBuffer = Buffer.from(arrayBuffer);
            console.log('📏 Image buffer size:', personaImageBuffer.length, 'bytes');
            
            // Validate that we have a reasonable image size
            if (personaImageBuffer.length < 1000) {
              console.warn('⚠️ Image buffer seems too small:', personaImageBuffer.length, 'bytes');
              throw new Error('Image buffer too small, likely corrupted');
            }
            
          } catch (imageError) {
            console.error('❌ Error fetching persona image:', imageError);
            console.log('⚠️ Continuing without persona image due to fetch error');
            personaImageBuffer = null;
          }
        } else {
          // Use a default image if no persona image is available
          console.log('⚠️ No persona image available, using default');
          // TODO: Add default image handling
        }
        
        if (personaImageBuffer) {
          // Convert PCM audio to WAV for ComfyUI
          const wavAudioBuffer = videoGenerationService.convertPCMToWAV(audioBuffer);
          
          // Generate video using ComfyUI workflow
          videoUrl = await videoGenerationService.generateVideo(
            wavAudioBuffer,
            personaImageBuffer,
            uid,
            currentChatId
          );
          
          console.log('✅ Video generation successful:', videoUrl);
        }
      } catch (videoError) {
        console.warn('⚠️ Video generation failed, continuing without video:', videoError.message);
        // Continue without video - this is graceful degradation
      }
    }

    // Save conversation to database with audio and video URLs (null if generation failed)
    console.log('💾 Saving conversation to database...');
    const savedChat = await db.saveConversation(uid, currentChatId, transcribedText, rawResponseText, selectedPersona, audioUrl, userAudioUrl, videoUrl);
    console.log('✅ Chat saved successfully:', savedChat?.id);

    // FOR UI: clean the response text of square brackets and their content
    const responseText = cleanResponseText(rawResponseText);
    
    console.log('🎉 Audio chat processing completed successfully');
    
    // Generate signed URLs for frontend access
    let signedAudioUrl = null;
    let signedUserAudioUrl = null;
    let signedVideoUrl = null;

    try {
      // Generate signed URL for assistant audio
      if (audioUrl) {
        signedAudioUrl = await s3Service.getSignedUrl(audioUrl, 3600); // 1 hour expiry
      }

      // Generate signed URL for user audio (multi-speaker mode)
      if (userAudioUrl) {
        signedUserAudioUrl = await s3Service.getSignedUrl(userAudioUrl, 3600);
      }

      // Generate signed URL for video
      if (videoUrl) {
        signedVideoUrl = await s3Service.getSignedUrl(videoUrl, 3600);
        console.log('✅ Generated signed video URL for frontend');
      }
    } catch (signError) {
      console.error('❌ Error generating signed URLs:', signError);
      // Continue with response even if signing fails
    }

    // Return JSON response with signed URLs for frontend processing
    res.json({
      transcribedText,
      responseText,
      audioUrl: signedAudioUrl, // Signed URL to fetch assistant audio file
      userAudioUrl: signedUserAudioUrl, // Signed URL to fetch user audio file (null for single-speaker mode)
      videoUrl: signedVideoUrl, // Signed URL to fetch video file (null if video not enabled or failed)
      timestamp: new Date().toISOString(),
      chatId: savedChat?.id || currentChatId,
      isMultiUserMode // Flag to indicate multi-user mode
    });
  } catch (error) {
    console.error('❌ Error in audio chat endpoint:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({ error: 'An error occurred processing your request', details: error.message });
  }
});

// Catch-all handler: send back React's index.html file for any non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
  });
}

// Add error handling for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

process.on('exit', (code) => {
  console.log('🔄 Process exiting with code:', code);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

app.listen(port, () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
  console.log('🚀 Server started successfully');
});

