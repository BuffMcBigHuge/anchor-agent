const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('node:crypto');

// S3 Configuration for audio-chat-bymarco bucket
const s3Config = {
  region: 'us-east-1',
  bucket: 'audio-chat-bymarco',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
};

// Initialize S3 client
const s3Client = new S3Client({
  credentials: s3Config.credentials,
  region: s3Config.region,
});

class S3Service {
  constructor() {
    this.client = s3Client;
    this.bucket = s3Config.bucket;
    this.region = s3Config.region;
  }

  /**
   * Upload audio file to S3 with format: uid/chatid/uuid.pcm
   * @param {Buffer} audioBuffer - Audio data as buffer
   * @param {string} uid - User ID
   * @param {string} chatId - Chat ID
   * @returns {Promise<string>} S3 key for the uploaded file
   */
  async uploadAudioFile(audioBuffer, uid, chatId) {
    try {
      const audioUuid = randomUUID();
      const filename = `${audioUuid}.pcm`;
      const key = `${uid}/${chatId}/${filename}`;

      console.log(`📤 Uploading audio to S3: ${key}`);
      console.log(`📏 Audio size: ${audioBuffer.length} bytes`);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: audioBuffer,
        ContentType: 'audio/L16', // PCM audio type
        Metadata: {
          'original-format': 'pcm',
          'sample-rate': '24000',
          'channels': '1',
          'bits-per-sample': '16'
        }
      });

      await this.client.send(command);
      console.log(`✅ Upload completed: ${key}`);
      
      return key;
    } catch (error) {
      console.error('❌ S3 upload failed:', error);
      throw new Error(`Failed to upload audio to S3: ${error.message}`);
    }
  }

  /**
   * Generate signed URLs for S3 objects
   * @param {string[]} keys - Array of S3 keys
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string[]>} Array of signed URLs
   */
  async getSignedUrls(keys, expiresIn = 3600) {
    const signUrl = async (key) => {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });

        return await getSignedUrl(this.client, command, { expiresIn });
      } catch (error) {
        console.error(`❌ Failed to sign URL for key: ${key}`, error);
        return null;
      }
    };

    const signedUrls = await Promise.all(keys.map(signUrl));
    
    // Filter out null results from failed signings
    const validUrls = signedUrls.filter(url => url !== null);
    
    console.log(`🔗 Generated ${validUrls.length}/${keys.length} signed URLs`);
    return validUrls;
  }

  /**
   * Generate a single signed URL for an S3 object
   * @param {string} key - S3 key
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      console.log(`🔗 Generated signed URL for: ${key}`);
      
      return signedUrl;
    } catch (error) {
      console.error(`❌ Failed to generate signed URL for: ${key}`, error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * List objects in S3 bucket with a given prefix
   * @param {string} prefix - S3 key prefix (e.g., 'uid/chatId/')
   * @returns {Promise<Array>} Array of S3 objects
   */
  async listObjects(prefix) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const response = await this.client.send(command);
      return response.Contents || [];
    } catch (error) {
      console.error(`❌ Failed to list objects with prefix: ${prefix}`, error);
      throw new Error(`Failed to list S3 objects: ${error.message}`);
    }
  }

  /**
   * Upload multiple audio files for multi-speaker conversations
   * @param {Buffer} audioBuffer - Audio data as buffer
   * @param {string} uid - User ID
   * @param {string} chatId - Chat ID
   * @returns {Promise<{userKey: string, assistantKey: string}>} S3 keys for both files
   */
  async uploadMultiSpeakerAudio(audioBuffer, uid, chatId) {
    try {
      const userKey = await this.uploadAudioFile(audioBuffer, uid, chatId);
      const assistantKey = await this.uploadAudioFile(audioBuffer, uid, chatId);
      
      return { userKey, assistantKey };
    } catch (error) {
      console.error('❌ Multi-speaker S3 upload failed:', error);
      throw new Error(`Failed to upload multi-speaker audio to S3: ${error.message}`);
    }
  }

  /**
   * Upload image file to S3 with format: personas/filename.webp
   * @param {Buffer} imageBuffer - Image data as buffer
   * @param {string} filename - Filename for the image
   * @param {string} contentType - MIME type of the image (default: 'image/webp')
   * @returns {Promise<string>} S3 key for the uploaded file
   */
  async uploadImageFile(imageBuffer, filename, contentType = 'image/webp') {
    try {
      const key = `personas/${filename}`;

      console.log(`📤 Uploading image to S3: ${key}`);
      console.log(`📏 Image size: ${imageBuffer.length} bytes`);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: imageBuffer,
        ContentType: contentType,
        Metadata: {
          'uploaded-at': new Date().toISOString()
        }
      });

      await this.client.send(command);
      console.log(`✅ Upload completed: ${key}`);
      
      return key;
    } catch (error) {
      console.error('❌ S3 image upload failed:', error);
      throw new Error(`Failed to upload image to S3: ${error.message}`);
    }
  }

  /**
   * Upload video file to S3 with format: uid/chatid/uuid.mp4
   * @param {Buffer} videoBuffer - Video data as buffer
   * @param {string} uid - User ID
   * @param {string} chatId - Chat ID
   * @returns {Promise<string>} S3 key for the uploaded file
   */
  async uploadVideoFile(videoBuffer, uid, chatId) {
    try {
      const videoUuid = randomUUID();
      const filename = `${videoUuid}.mp4`;
      const key = `${uid}/${chatId}/${filename}`;

      console.log(`📤 Uploading video to S3: ${key}`);
      console.log(`📏 Video size: ${videoBuffer.length} bytes`);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: videoBuffer,
        ContentType: 'video/mp4',
        Metadata: {
          'original-format': 'mp4',
          'uploaded-at': new Date().toISOString()
        }
      });

      await this.client.send(command);
      console.log(`✅ Video upload completed: ${key}`);
      
      return key;
    } catch (error) {
      console.error('❌ S3 video upload failed:', error);
      throw new Error(`Failed to upload video to S3: ${error.message}`);
    }
  }

  /**
   * Check if S3 connection is working
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.client.send(command);
      console.log('✅ S3 connection test successful');
      return true;
    } catch (error) {
      console.error('❌ S3 connection test failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const s3Service = new S3Service();

module.exports = s3Service; 