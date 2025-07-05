require('dotenv').config({ path: '.env.development' });

const { readFileSync, writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');

const ComfyUI = require('../utils/ComfyUI');
const s3Service = require('../utils/s3');

// Configuration
const COMFY_UI_SERVER_URL = process.env.COMFY_UI_SERVER_URL || 'http://localhost:8188';
const PERSONAS_FILE_PATH = join(__dirname, '../configs/personas.json');
const WORKFLOW_FILE_PATH = join(__dirname, '../workflows/t2i-flux-api.json');
const LOCAL_IMAGES_DIR = join(__dirname, '../output/images');

// Validate environment variables
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ Error: AWS credentials are required');
  console.error('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
  process.exit(1);
}

class PersonaImageGenerator {
  constructor() {
    this.workflowData = null;
    this.personas = null;
    this.processedCount = 0;
    this.totalCount = 0;
    
    // Ensure local images directory exists
    this.ensureLocalImagesDir();
  }

  /**
   * Ensure the local images directory exists
   */
  ensureLocalImagesDir() {
    if (!existsSync(LOCAL_IMAGES_DIR)) {
      mkdirSync(LOCAL_IMAGES_DIR, { recursive: true });
      console.log(`📁 Created local images directory: ${LOCAL_IMAGES_DIR}`);
    }
  }

  /**
   * Load personas from JSON file
   */
  loadPersonas() {
    try {
      console.log('📖 Loading personas from config file...');
      const personasData = JSON.parse(readFileSync(PERSONAS_FILE_PATH, 'utf8'));
      this.personas = personasData.personas;
      this.totalCount = this.personas.length;
      console.log(`✅ Loaded ${this.totalCount} personas`);
      return true;
    } catch (error) {
      console.error('❌ Error loading personas:', error.message);
      return false;
    }
  }

  /**
   * Load ComfyUI workflow template
   */
  loadWorkflow() {
    try {
      console.log('📖 Loading ComfyUI workflow...');
      this.workflowData = JSON.parse(readFileSync(WORKFLOW_FILE_PATH, 'utf8'));
      console.log('✅ Workflow loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Error loading workflow:', error.message);
      return false;
    }
  }

  /**
   * Save image locally and upload to S3
   * @param {Buffer} imageBuffer - Image data as buffer
   * @param {string} personaName - Name of the persona for the filename
   * @returns {Promise<{s3Url: string, localPath: string}>} S3 URL and local file path
   */
  async saveImageLocallyAndS3(imageBuffer, personaName) {
    try {
      // Convert image to WebP format for better compression
      const webpBuffer = await sharp(imageBuffer)
        .webp({ quality: 85 })
        .toBuffer();

      // Create filename with persona name (sanitized)
      const sanitizedName = personaName.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const imageUuid = randomUUID();
      const filename = `${sanitizedName}-${imageUuid}.webp`;

      // Save locally
      const localPath = join(LOCAL_IMAGES_DIR, filename);
      writeFileSync(localPath, webpBuffer);
      console.log(`💾 Image saved locally: ${localPath}`);

      // Upload to S3
      const s3Key = await s3Service.uploadImageFile(webpBuffer, filename);
      
      // Generate public URL
      const s3Url = `https://${s3Service.bucket}.s3.${s3Service.region}.amazonaws.com/${s3Key}`;
      console.log(`☁️  Image uploaded to S3: ${s3Url}`);
      
      return { s3Url, localPath };
    } catch (error) {
      console.error('❌ Error saving image:', error);
      throw error;
    }
  }

  /**
   * Generate image for a single persona
   * @param {Object} persona - Persona object
   * @returns {Promise<string>} S3 URL of generated image
   */
  async generatePersonaImage(persona) {
    return new Promise((resolve, reject) => {
      console.log(`\n🎨 Generating image for: ${persona.name}`);
      console.log(`📝 Description: ${persona.description.substring(0, 100)}...`);

      try {
        // Clone workflow data to avoid modifying the original
        const workflowDataAPI = JSON.parse(JSON.stringify(this.workflowData));
        
        // Update the prompt with persona description
        const promptText = `an upper body view of a canadian news anchor in a studio looking at camera reporting top stories, hands on the table infront. The look of the news anchor ${persona.description}`;
        workflowDataAPI["6"].inputs.text = promptText;

        // Generate random seed for uniqueness
        const seed = Math.floor(Math.random() * 99999999999999);
        workflowDataAPI["25"].inputs.noise_seed = seed;

        // Create ComfyUI instance
        const comfy = new ComfyUI({
          comfyUIServerURL: COMFY_UI_SERVER_URL,
          nodes: {
            api_save: ["55"] // Node ID for SaveImage with title "SAVE"
          },
          onSaveCallback: async ({ message, promptId }) => {
            console.log(`💾 Save callback triggered for ${persona.name}`);
            
            try {
              const files = message.data.output.images || [];
              
              if (files.length === 0) {
                throw new Error('No images generated');
              }

              // Get the first image
              const imageFile = files[0];
              console.log(`📥 Retrieving image: ${imageFile.filename}`);

              // Download image from ComfyUI
              const imageBuffer = await comfy.getFile({
                filename: imageFile.filename,
                subfolder: imageFile.subfolder,
                type: imageFile.type
              });

              // Save locally and upload to S3
              const { s3Url, localPath } = await this.saveImageLocallyAndS3(Buffer.from(imageBuffer), persona.name);
              
              // Disconnect ComfyUI
              comfy.disconnect();
              
              resolve({ s3Url, localPath });
            } catch (error) {
              console.error(`❌ Error in save callback for ${persona.name}:`, error);
              comfy.disconnect();
              reject(error);
            }
          },
          onMessageCallback: async ({ message, promptId }) => {
            if (message.type === 'execution_error') {
              console.error(`❌ Execution error for ${persona.name}:`, message.data?.exception_message);
              reject(new Error(message.data?.exception_message || 'Unknown execution error'));
            } else if (message.type === 'execution_success') {
              console.log(`✅ Execution completed for ${persona.name}`);
            }
          },
          onOpenCallback: async (comfyInstance) => {
            console.log(`🔗 Connected to ComfyUI for ${persona.name}`);
            
            try {
              await comfyInstance.queue({ workflowDataAPI });
              console.log(`📋 Workflow queued for ${persona.name}`);
            } catch (error) {
              console.error(`❌ Error queuing workflow for ${persona.name}:`, error);
              comfyInstance.disconnect();
              reject(error);
            }
          }
        });

        // Set timeout to prevent hanging
        setTimeout(() => {
          comfy.disconnect();
          reject(new Error(`Timeout generating image for ${persona.name}`));
        }, 300000); // 5 minutes timeout

      } catch (error) {
        console.error(`❌ Error setting up ComfyUI for ${persona.name}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Process all personas sequentially
   */
  async processAllPersonas() {
    console.log(`\n🚀 Starting image generation for ${this.totalCount} personas...`);
    
    const updatedPersonas = [];
    
    for (let i = 0; i < this.personas.length; i++) {
      const persona = this.personas[i];
      
      try {
        console.log(`\n📊 Progress: ${i + 1}/${this.totalCount}`);
        
        // Skip if persona already has an image URL
        if (persona.imageUrl) {
          console.log(`⏭️  Skipping ${persona.name} - already has image URL`);
          updatedPersonas.push(persona);
          continue;
        }

        // Generate image
        const { s3Url, localPath } = await this.generatePersonaImage(persona);
        
        // Update persona with image URL
        const updatedPersona = {
          ...persona,
          imageUrl: s3Url
        };
        
        updatedPersonas.push(updatedPersona);
        this.processedCount++;
        
        console.log(`✅ Completed ${persona.name} (${this.processedCount}/${this.totalCount})`);
        console.log(`   📁 Local: ${localPath}`);
        console.log(`   ☁️  S3: ${s3Url}`);
        
        // Add delay between requests to avoid overwhelming ComfyUI
        if (i < this.personas.length - 1) {
          console.log('⏳ Waiting 5 seconds before next generation...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
      } catch (error) {
        console.error(`❌ Failed to generate image for ${persona.name}:`, error.message);
        
        // Add persona without image URL to continue processing
        updatedPersonas.push(persona);
      }
    }
    
    return updatedPersonas;
  }

  /**
   * Save updated personas back to JSON file
   * @param {Array} updatedPersonas - Array of updated persona objects
   */
  saveUpdatedPersonas(updatedPersonas) {
    try {
      console.log('\n💾 Saving updated personas to config file...');
      
      const updatedData = {
        personas: updatedPersonas
      };
      
      // Create backup of original file
      const backupPath = PERSONAS_FILE_PATH + '.backup.' + Date.now();
      const originalContent = readFileSync(PERSONAS_FILE_PATH, 'utf8');
      writeFileSync(backupPath, originalContent);
      console.log(`📋 Backup created: ${backupPath}`);
      
      // Write updated data
      writeFileSync(PERSONAS_FILE_PATH, JSON.stringify(updatedData, null, 2));
      console.log('✅ Updated personas saved successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Error saving updated personas:', error.message);
      return false;
    }
  }

  /**
   * Run the complete persona image generation process
   */
  async run() {
    console.log('🎬 Starting Persona Image Generation Script');
    console.log('==========================================\n');

    try {
      // Load data
      if (!this.loadPersonas() || !this.loadWorkflow()) {
        process.exit(1);
      }

      // Test S3 connection
      console.log('🔍 Testing S3 connection...');
      const s3Connected = await s3Service.testConnection();
      if (!s3Connected) {
        console.error('❌ S3 connection failed');
        process.exit(1);
      }

      // Process all personas
      const updatedPersonas = await this.processAllPersonas();

      // Save updated personas
      if (!this.saveUpdatedPersonas(updatedPersonas)) {
        process.exit(1);
      }

      // Summary
      console.log('\n🎉 Persona Image Generation Complete!');
      console.log('=====================================');
      console.log(`📊 Total personas: ${this.totalCount}`);
      console.log(`✅ Successfully processed: ${this.processedCount}`);
      console.log(`❌ Failed: ${this.totalCount - this.processedCount}`);
      
      const personasWithImages = updatedPersonas.filter(p => p.imageUrl).length;
      console.log(`🖼️  Personas with images: ${personasWithImages}`);
      console.log(`📁 Local images saved to: ${LOCAL_IMAGES_DIR}`);
      console.log(`☁️  Images uploaded to S3: personas/ folder`);
      
      if (personasWithImages > 0) {
        console.log('\n💡 Next steps:');
        console.log('1. Check local images in: output/images/');
        console.log('2. Run the sync script to update the database:');
        console.log('   node scripts/sync-personas.js');
      }

    } catch (error) {
      console.error('❌ Fatal error:', error.message);
      process.exit(1);
    }
  }
}

// Run the script
if (require.main === module) {
  const generator = new PersonaImageGenerator();
  generator.run().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = PersonaImageGenerator; 