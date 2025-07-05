// Video Generation Service
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.development') });

const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const ComfyUI = require('./ComfyUI');
const s3Service = require('./s3');

class VideoGenerationService {
  constructor() {
    this.comfyUIServerURL = process.env.COMFY_UI_SERVER_URL || 'http://localhost:8188';
    this.workflowPath = path.join(__dirname, '..', 'workflows', 'i2v-wan-api.json');
  }

  /**
   * Generate video from audio and image using ComfyUI workflow
   * @param {Buffer} audioBuffer - Audio data as buffer
   * @param {Buffer} imageBuffer - Image data as buffer (persona image)
   * @param {string} uid - User ID
   * @param {string} chatId - Chat ID
   * @returns {Promise<string>} S3 key for the generated video
   */
  async generateVideo(audioBuffer, imageBuffer, uid, chatId) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('🎬 Starting video generation process...');

        // Load the ComfyUI workflow
        const workflowData = JSON.parse(fs.readFileSync(this.workflowPath, 'utf8'));
        console.log('📋 Loaded ComfyUI workflow from:', this.workflowPath);

        // Generate unique filenames for uploads
        const audioFilename = `audio_${randomUUID()}.wav`;
        const imageFilename = `image_${randomUUID()}.png`;

        // Set up ComfyUI connection with callbacks
        const comfyUI = new ComfyUI({
          comfyUIServerURL: this.comfyUIServerURL,
          nodes: {
            api_save: ['131'] // VHS_VideoCombine node ID from workflow
          },
          onSaveCallback: async ({ message }) => {
            try {
              console.log('💾 ComfyUI save callback triggered');
              
              // Get the generated video file
              const videoData = await this.downloadGeneratedVideo(comfyUI, message);
              
              // Upload video to S3
              const videoKey = await s3Service.uploadVideoFile(videoData, uid, chatId);
              console.log('✅ Video uploaded to S3:', videoKey);
              
              // Clean up ComfyUI connection
              comfyUI.disconnect();
              
              resolve(videoKey);
            } catch (error) {
              console.error('❌ Error in save callback:', error);
              comfyUI.disconnect();
              reject(error);
            }
          },
          onMessageCallback: ({ message }) => {
            if (message.type === 'execution_error') {
              console.error('❌ ComfyUI execution error:', message);
              comfyUI.disconnect();
              reject(new Error('ComfyUI execution failed'));
            }
          }
        });

        // Wait for ComfyUI connection to be established
        await this.waitForConnection(comfyUI);

        // Upload audio file to ComfyUI
        console.log('📤 Uploading audio to ComfyUI...');
        await comfyUI.uploadAudio({
          audioBuffer: audioBuffer,
          filename: audioFilename
        });

        // Upload image file to ComfyUI
        console.log('📤 Uploading image to ComfyUI...');
        await comfyUI.uploadImage({
          imageBuffer: imageBuffer,
          filename: imageFilename
        });

        // Update workflow with uploaded filenames
        this.updateWorkflowWithFiles(workflowData, audioFilename, imageFilename);

        // Queue the workflow
        console.log('🚀 Queuing ComfyUI workflow...');
        await comfyUI.queue({ workflowDataAPI: workflowData });

      } catch (error) {
        console.error('❌ Video generation failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Wait for ComfyUI connection to be established
   * @param {ComfyUI} comfyUI - ComfyUI instance
   * @returns {Promise<void>}
   */
  waitForConnection(comfyUI) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ComfyUI connection timeout'));
      }, 30000); // 30 second timeout

      comfyUI.onOpenCallback = () => {
        clearTimeout(timeout);
        console.log('✅ ComfyUI connection established');
        resolve();
      };
    });
  }

  /**
   * Update the workflow with uploaded file names
   * @param {Object} workflowData - The workflow JSON data
   * @param {string} audioFilename - Name of uploaded audio file
   * @param {string} imageFilename - Name of uploaded image file
   */
  updateWorkflowWithFiles(workflowData, audioFilename, imageFilename) {
    // Update audio input node (LoadAudio - node 125)
    if (workflowData['125'] && workflowData['125'].inputs) {
      workflowData['125'].inputs.audio = audioFilename;
      console.log('🎵 Updated audio input:', audioFilename);
    }

    // Update image input node (LoadImage - node 133)
    if (workflowData['133'] && workflowData['133'].inputs) {
      workflowData['133'].inputs.image = imageFilename;
      console.log('🖼️ Updated image input:', imageFilename);
    }
  }

  /**
   * Download the generated video from ComfyUI
   * @param {ComfyUI} comfyUI - ComfyUI instance
   * @param {Object} message - Save callback message
   * @returns {Promise<Buffer>} Video data as buffer
   */
  async downloadGeneratedVideo(comfyUI, message) {
    try {
      console.log('📥 Downloading generated video from ComfyUI...');
      
      // Extract file information from the message
      const outputs = message.data.output;
      if (!outputs || !outputs.gifs || outputs.gifs.length === 0) {
        throw new Error('No video output found in ComfyUI response');
      }

      const videoInfo = outputs.gifs[0];
      const filename = videoInfo.filename;
      const subfolder = videoInfo.subfolder || '';
      const type = videoInfo.type || 'output';

      console.log('📄 Video file info:', { filename, subfolder, type });

      // Download the video file
      const videoBuffer = await comfyUI.getFile({
        filename: filename,
        subfolder: subfolder,
        type: type
      });

      console.log('✅ Video downloaded successfully, size:', videoBuffer.byteLength, 'bytes');
      
      // Validate video data
      if (videoBuffer.byteLength < 1000) {
        throw new Error(`Video file too small: ${videoBuffer.byteLength} bytes`);
      }
      
      // Check if this looks like a valid video file (MP4 should start with specific bytes)
      const videoDataBuffer = Buffer.from(videoBuffer);
      const firstBytes = videoDataBuffer.slice(0, 8);
      console.log('🔍 Video file header (first 8 bytes):', firstBytes.toString('hex'));
      
      return videoDataBuffer;

    } catch (error) {
      console.error('❌ Failed to download video from ComfyUI:', error);
      throw error;
    }
  }

  /**
   * Convert PCM audio to WAV format for ComfyUI
   * @param {Buffer} pcmBuffer - PCM audio data
   * @returns {Buffer} WAV audio data
   */
  convertPCMToWAV(pcmBuffer) {
    // Simple WAV header for 16-bit PCM at 24kHz mono
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = pcmBuffer.length;
    const fileSize = 36 + dataSize;

    const wavHeader = Buffer.alloc(44);
    
    // RIFF header
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(fileSize, 4);
    wavHeader.write('WAVE', 8);
    
    // fmt chunk
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // chunk size
    wavHeader.writeUInt16LE(1, 20);  // audio format (PCM)
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    
    // data chunk
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    return Buffer.concat([wavHeader, pcmBuffer]);
  }
}

// Create and export singleton instance
const videoGenerationService = new VideoGenerationService();

module.exports = videoGenerationService; 