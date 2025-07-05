const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.development') });

const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const s3Service = require('./s3');

// Ensure audio_files directory exists
const audioFilesDir = path.resolve(__dirname, '..', 'audio_files');
if (!fs.existsSync(audioFilesDir)) {
  fs.mkdirSync(audioFilesDir, { recursive: true });
}

// Note: Bulk URL signing functions removed - we now use on-demand signing via /api/audio/sign endpoint

// Helper function to save audio file to S3 and return S3 key (for database storage)
async function saveAudioFile(audioData, audioMimeType, uid, chatId, req) {
  try {
    // Convert base64 audio data to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    console.log(`🔧 Attempting to upload ${audioBuffer.length} bytes to S3 for chat ${chatId}`);
    
    // Upload to S3 with format: uid/chatid/uuid.pcm
    const s3Key = await s3Service.uploadAudioFile(audioBuffer, uid, chatId);
    
    console.log('✅ Audio file uploaded to S3:', s3Key);
    
    // Verify the upload by testing if we can generate a signed URL
    try {
      await s3Service.getSignedUrl(s3Key, 60); // Test with 1-minute expiry
      console.log('✅ S3 upload verified - signed URL generation successful');
    } catch (verifyError) {
      console.error('❌ S3 upload verification failed:', verifyError);
      throw new Error(`S3 upload verification failed: ${verifyError.message}`);
    }
    
    // Return S3 key for database storage (will be signed when needed)
    return s3Key;
  } catch (error) {
    console.error('❌ Error saving audio file to S3:', error);
    console.error('❌ S3 Error details:', error.message, error.stack);
    
    // Fallback to local storage if S3 fails
    console.warn('⚠️ Falling back to local storage...');
    return await saveAudioFileLocal(audioData, audioMimeType, uid, chatId, req);
  }
}

// Fallback function for local storage (kept for migration and backup)
async function saveAudioFileLocal(audioData, audioMimeType, uid, chatId, req) {
  try {
    // Generate UUID for filename - Google always returns PCM
    const audioUuid = randomUUID();
    const filename = `${audioUuid}.pcm`;
    
    // Ensure user and chat directory exists
    const chatAudioDir = path.join(audioFilesDir, uid, chatId);
    if (!fs.existsSync(chatAudioDir)) {
      fs.mkdirSync(chatAudioDir, { recursive: true });
    }
    
    // Save audio file
    const filePath = path.join(chatAudioDir, filename);
    const audioBuffer = Buffer.from(audioData, 'base64');
    fs.writeFileSync(filePath, audioBuffer);
    
    // Generate full URL with proper protocol detection for cloud environments
    // Check for forwarded protocol headers (common in cloud environments)
    const forwardedProto = req.get('x-forwarded-proto') || req.get('x-forwarded-protocol');
    const isSecure = forwardedProto === 'https' || req.secure || req.connection.encrypted;
    
    // Default to HTTPS for production environments (.replit.dev domains)
    const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    const isReplitDomain = host.includes('.replit.dev');
    const protocol = isSecure || isReplitDomain ? 'https' : 'http';
    
    const audioUrl = `${protocol}://${host}/api/audio/${uid}/${chatId}/${filename}`;
    
    console.log('Audio file saved locally:', filePath);
    console.log('Local audio URL:', audioUrl);
    
    return audioUrl;
  } catch (error) {
    console.error('Error saving audio file locally:', error);
    return null;
  }
}

// Helper function to save multi-speaker audio and return S3 keys for both user and assistant
async function saveMultiSpeakerAudio(conversationAudioData, audioMimeType, uid, chatId, req) {
  try {
    // Convert base64 audio data to buffer
    const audioBuffer = Buffer.from(conversationAudioData, 'base64');
    
    console.log(`🔧 Attempting to upload ${audioBuffer.length} bytes (multi-speaker) to S3 for chat ${chatId}`);
    
    // Upload both user and assistant audio to S3
    const { userKey, assistantKey } = await s3Service.uploadMultiSpeakerAudio(audioBuffer, uid, chatId);
    
    console.log('✅ Multi-speaker audio files uploaded to S3:', { userKey, assistantKey });
    
    // Verify both uploads by testing signed URL generation
    try {
      await Promise.all([
        s3Service.getSignedUrl(userKey, 60),
        s3Service.getSignedUrl(assistantKey, 60)
      ]);
      console.log('✅ Multi-speaker S3 uploads verified - both signed URLs generated successfully');
    } catch (verifyError) {
      console.error('❌ Multi-speaker S3 upload verification failed:', verifyError);
      throw new Error(`Multi-speaker S3 upload verification failed: ${verifyError.message}`);
    }
    
    // Return S3 keys for database storage (will be signed when needed)
    return { userAudioUrl: userKey, assistantAudioUrl: assistantKey };
  } catch (error) {
    console.error('❌ Error saving multi-speaker audio files to S3:', error);
    console.error('❌ Multi-speaker S3 Error details:', error.message, error.stack);
    
    // Fallback to local storage
    console.warn('⚠️ Falling back to local multi-speaker storage...');
    const userAudioUrl = await saveAudioFileLocal(conversationAudioData, audioMimeType, uid, chatId, req);
    const assistantAudioUrl = await saveAudioFileLocal(conversationAudioData, audioMimeType, uid, chatId, req);
    
    return { userAudioUrl, assistantAudioUrl };
  }
}

module.exports = {
  saveAudioFile,
  saveMultiSpeakerAudio,
  saveAudioFileLocal, // Export for migration script
};