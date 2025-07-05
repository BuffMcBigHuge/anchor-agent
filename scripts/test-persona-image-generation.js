require('dotenv').config({ path: '.env.development' });

const PersonaImageGenerator = require('./generate-persona-images');

/**
 * Test script to generate an image for a single persona
 */
async function testPersonaImageGeneration() {
  console.log('🧪 Testing Persona Image Generation');
  console.log('==================================\n');

  try {
    const generator = new PersonaImageGenerator();
    
    // Load the workflow and personas
    if (!generator.loadWorkflow()) {
      console.error('❌ Failed to load workflow');
      return;
    }
    
    if (!generator.loadPersonas()) {
      console.error('❌ Failed to load personas');
      return;
    }

    // Test with the first persona
    const testPersona = generator.personas[0];
    console.log(`🎯 Testing with persona: ${testPersona.name}`);
    
    // Generate image
    const { s3Url, localPath } = await generator.generatePersonaImage(testPersona);
    
    console.log(`✅ Test completed successfully!`);
    console.log(`📁 Local file: ${localPath}`);
    console.log(`☁️  S3 URL: ${s3Url}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testPersonaImageGeneration(); 