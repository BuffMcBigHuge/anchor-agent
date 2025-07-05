const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.development') });

const { GoogleGenAI } = require('@google/genai');
const brightdataService = require('./brightdata');

class AIService {
  constructor() {
    this.genAI = new GoogleGenAI({
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });
  }

  // Helper function to generate AI response using chat API
  async generateAIResponse(userMessage, selectedPersona, chatHistory, locations = []) {
    // Validate selectedPersona
    if (!selectedPersona || !selectedPersona.name) {
      throw new Error(`selectedPersona is required and must have a name property. Received: ${JSON.stringify(selectedPersona)}`);
    }

    // Crawl Reddit news for specified locations if provided
    let newsContext = '';
    if (locations && locations.length > 0) {
      console.log('📰 Crawling Reddit discussions for locations:', locations);
      
      const newsResults = await Promise.allSettled(
        locations.map(location => brightdataService.crawlRedditNews(location, userMessage))
      );
      
      const successfulCrawls = newsResults
        .filter(result => result.status === 'fulfilled' && result.value.success)
        .map(result => result.value);
      
      if (successfulCrawls.length > 0) {
        const allArticles = successfulCrawls.flatMap(crawl => crawl.articles);
        newsContext = brightdataService.generateNewsContext(allArticles, locations.join(', '));
        console.log('✅ Reddit news context generated:', newsContext.length, 'characters');
      } else {
        console.log('⚠️ No successful Reddit crawls found');
      }
    }

    // Create system instruction
    const systemInstruction = `
**YOUR ROLE:**
- Character Name: ${selectedPersona.name}
- Character Description: ${selectedPersona.description || 'A character in a story.'}
- Character Tone: ${selectedPersona.tone}
${newsContext ? `\n**CURRENT NEWS BRIEFING:**\n${newsContext}\n\n**NEWS ANCHOR INSTRUCTIONS:** You have access to current community discussions and local news from Reddit, including community reactions and comments. Present this information as a knowledgeable news anchor would - with authority, clarity, and engagement. Transform community discussions into coherent news segments. Use phrases like "According to community discussions...", "Local residents are reporting...", "The community is buzzing about...", "One resident commented...", "Community members are responding...". When relevant, reference specific community feedback to show public sentiment. Maintain journalistic integrity while acknowledging these are community-sourced insights, not traditional news reports. Focus on the most newsworthy and relevant information for your audience.` : ''}

**RULES:**
-- Include distinct expression tags in your responses to match the conversation, written in square brackets.
-- Expression tags should not describe visible movement, only vocalized audible emotions.
-- Your response will be spoken aloud by a audio method actor.
-- If you have news context, prioritize delivering newsworthy information in a clear, engaging manner.
-- Your response needs to be 1-2 sentences maximum and focus on the news context ONLY.
-- Try and speak quickly and concisely as a news anchor would.

**EXPRESSION TAGS:**
Positive & Joyful
[laughing]
[chuckles]
[giggles]
[soft laugh]
[hearty laugh]
[nervous laugh]
[cackles]
[snorts with laughter]
[amused snort]
[whoops]
[excited gasp]
[joyful yell]
[humming happily]

**EXAMPLES:**

**Example 1:**
User: Are you sure about this? It seems dangerous.
${selectedPersona.name}: I have to be. [huffs] There's no other way. [soft laugh]

**Example 2:**
User: I brought you a coffee.
${selectedPersona.name}: [laughter] Oh! You really didn't have to do that [screams in excitement]

Now, begin the conversation.
`

/* UNUSED
Sadness & Distress
[crying]
[sobbing]
[whimpering]
[sniffles]
[stifled sob]
[voice breaking]
[mournful wail]
[hiccups through tears]

Anger & Frustration
[screaming]
[shouting]
[growls]
[snarls]
[hisses]
[huffs in frustration]
[annoyed groan]
[muttering angrily]
[grinds teeth]
[sharp, angry exhale]
[sputters]

Fear, Shock & Surprise
[gasps]
[sharp inhale]
[shaky breath]
[stammers]
[choked scream]
[fearful whimper]
[shrieks]
[surprised yell]

Effort, Pain & Relief
[breathing heavily]
[panting]
[out of breath]
[groans in pain]
[winces audibly]
[hisses in pain]
[grunts with effort]
[sighs in relief]
[long exhale]

Contempt, Disbelief & Annoyance
[scoffs]
[tuts] or [tsk]
[sighs]
[annoyed sigh]
[skeptical hum]
[dry laugh]
[muttering under breath]

Vocal Nuances & Pauses
[whispering]
[strained voice]
[hoarse whisper]
[trembling voice]
[raspy voice]
[clears throat]
[clicks tongue]
[smacks lips]
[thoughtful hum]
[dreamy sigh]
*/

    // Format chat history
    const formattedHistory = chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    console.log('\nSystem instruction:', systemInstruction);
    console.log('\nChat history length:', formattedHistory.length);

    // Create chat with history and system instruction
    const chat = this.genAI.chats.create({
      model: "gemini-2.5-flash",
      history: formattedHistory,
      config: {
        systemInstruction,
      }
    });

    // Send the user message
    const response = await chat.sendMessage({
      message: userMessage
    });

    return response.text;
  }

  // Helper function to generate audio from text
  async generateAudio(responseText, selectedPersona) {
    // Create enhanced TTS prompt with natural language instructions for speech control
    const ttsPrompt = `Say this in the style, ${selectedPersona.tone}: ${responseText}`;
    console.log('TTS prompt:', ttsPrompt);

    // Convert to speech with enhanced prompting for better voice control
    const audioResponse = await this.genAI.models.generateContent({
      model: "gemini-2.5-pro-preview-tts",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
              voiceName: selectedPersona.voice_name || selectedPersona.voiceName // Handle both database and legacy format
            }
          }
        }
      }
    });

    // Extract L16 PCM audio data from GenAI response
    const audioInlineData = audioResponse.candidates[0].content.parts[0].inlineData;
    const audioData = audioInlineData.data;
    const responseMimeType = audioInlineData.mimeType;
    
    console.log('🎵 GenAI returned audio with MIME type:', responseMimeType);
    console.log('📏 PCM audio data size (base64):', audioData.length);

    return { audioData, responseMimeType };
  }

  // Helper function to generate multi-speaker audio for conversations
  async generateMultiSpeakerAudio(userMessage, assistantResponse, userPersona, assistantPersona) {
    // Create conversation prompt for multi-speaker TTS
    const conversationPrompt = `TTS the following conversation between ${userPersona.name} and ${assistantPersona.name}:
${userPersona.name}: ${userMessage}
${assistantPersona.name}: ${assistantResponse}`;
    
    console.log('Multi-speaker TTS prompt:', conversationPrompt);

    // Convert to speech with multi-speaker configuration
    const audioResponse = await this.genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: conversationPrompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: userPersona.name,
                voiceConfig: {
                  prebuiltVoiceConfig: { 
                    voiceName: userPersona.voice_name || userPersona.voiceName 
                  }
                }
              },
              {
                speaker: assistantPersona.name,
                voiceConfig: {
                  prebuiltVoiceConfig: { 
                    voiceName: assistantPersona.voice_name || assistantPersona.voiceName 
                  }
                }
              }
            ]
          }
        }
      }
    });

    // Extract L16 PCM audio data from GenAI response
    const audioInlineData = audioResponse.candidates[0].content.parts[0].inlineData;
    const audioData = audioInlineData.data;
    const responseMimeType = audioInlineData.mimeType;
    
    console.log('🎵 Multi-speaker GenAI returned audio with MIME type:', responseMimeType);
    console.log('📏 Multi-speaker PCM audio data size (base64):', audioData.length);

    return { audioData, responseMimeType };
  }

  // Helper function to transcribe audio to text using Gemini's audio understanding
  async transcribeAudio(audioData, mimeType = "audio/wav") {
    const sttResponse = await this.genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{
        parts: [{
          inlineData: {
            data: audioData,
            mimeType: mimeType
          }
        }, {
          text: "Please transcribe this audio. Transcribed text:"
        }]
      }]
    });

    const transcribedText = sttResponse.candidates[0].content.parts[0].text;
    console.log('Transcribed text:', transcribedText);
    
    return transcribedText;
  }

  // Getter for accessing the GenAI client directly if needed
  get client() {
    return this.genAI;
  }
}

// Create and export a singleton instance
const aiService = new AIService();

module.exports = aiService;