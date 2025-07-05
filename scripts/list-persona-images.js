const { readdirSync, statSync } = require('fs');
const { join } = require('path');

const LOCAL_IMAGES_DIR = join(__dirname, '../output/images');

/**
 * List all persona images in the local directory
 */
function listPersonaImages() {
  console.log('📁 Persona Images in Local Directory');
  console.log('===================================\n');

  try {
    const files = readdirSync(LOCAL_IMAGES_DIR);
    const imageFiles = files.filter(file => file.endsWith('.webp'));

    if (imageFiles.length === 0) {
      console.log('📭 No persona images found in output/images/');
      console.log('💡 Run "npm run generate:persona-images" to generate images');
      return;
    }

    console.log(`🖼️  Found ${imageFiles.length} persona images:\n`);

    imageFiles.forEach((file, index) => {
      const filePath = join(LOCAL_IMAGES_DIR, file);
      const stats = statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);
      const personaName = file.replace(/-[a-f0-9-]+\.webp$/, '').replace(/-/g, ' ');

      console.log(`${index + 1}. ${file}`);
      console.log(`   📝 Persona: ${personaName}`);
      console.log(`   📏 Size: ${sizeKB} KB`);
      console.log(`   📅 Created: ${stats.birthtime.toLocaleDateString()} ${stats.birthtime.toLocaleTimeString()}`);
      console.log(`   📂 Path: ${filePath}`);
      console.log('');
    });

    console.log(`📊 Total images: ${imageFiles.length}`);
    console.log(`📁 Directory: ${LOCAL_IMAGES_DIR}`);

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📭 Local images directory does not exist');
      console.log('💡 Run "npm run generate:persona-images" to generate images');
    } else {
      console.error('❌ Error listing images:', error.message);
    }
  }
}

// Run the script
listPersonaImages(); 