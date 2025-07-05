require('dotenv').config({ path: '.env.development' });

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { randomUUID } = require('node:crypto');
const { join } = require('path');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Please set it with: export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncPersonas() {
  try {
    console.log('🚀 Starting persona sync...');
    
    // Read personas from JSON file
    const personasPath = join(__dirname, '../configs/personas.json');
    const personasData = JSON.parse(readFileSync(personasPath, 'utf8'));

    // Pull all existing personas from supabase
    const { data: existingPersonas, error: fetchExistingError } = await supabase
      .from('personas')
      .select('*');

    if (fetchExistingError) {
      throw new Error(`Failed to fetch existing personas: ${fetchExistingError.message}`);
    }

    console.log(`📖 Found ${personasData.personas.length} personas to sync`);
    console.log(`📚 Found ${existingPersonas?.length || 0} existing personas in database`);
    
    // Create a map of existing personas by name for easy lookup
    const existingPersonasMap = new Map(
      (existingPersonas || []).map(persona => [persona.name, persona])
    );
    
    // Transform personas from JSON file
    const personasFromFile = personasData.personas.map(persona => ({
      name: persona.name,
      description: persona.description,
      tone: persona.tone,
      voice_name: persona.voiceName, // Convert camelCase to snake_case for database
      image_url: persona.imageUrl || null // Handle optional image_url field
    }));
    
    // Separate personas into new and existing
    const newPersonas = [];
    const personasToUpdate = [];
    
    personasFromFile.forEach(persona => {
      if (existingPersonasMap.has(persona.name)) {
        // Persona exists, prepare for update
        const existingPersona = existingPersonasMap.get(persona.name);
        personasToUpdate.push({
          id: existingPersona.id,
          name: persona.name,
          description: persona.description,
          tone: persona.tone,
          voice_name: persona.voice_name,
          image_url: persona.image_url
        });
      } else {
        // New persona, add UUID and prepare for insert
        newPersonas.push({
          id: randomUUID(),
          name: persona.name,
          description: persona.description,
          tone: persona.tone,
          voice_name: persona.voice_name,
          image_url: persona.image_url
        });
      }
    });
    
    console.log(`📝 ${newPersonas.length} new personas to insert`);
    console.log(`🔄 ${personasToUpdate.length} existing personas to update`);
    
    const results = {
      inserted: [],
      updated: []
    };
    
    // Insert new personas
    if (newPersonas.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('personas')
        .insert(newPersonas)
        .select();
      
      if (insertError) {
        throw new Error(`Failed to insert personas: ${insertError.message}`);
      }
      
      results.inserted = insertedData;
      console.log(`✅ Successfully inserted ${insertedData.length} new personas`);
    }
    
    // Update existing personas
    if (personasToUpdate.length > 0) {
      for (const persona of personasToUpdate) {
        const { data: updatedData, error: updateError } = await supabase
          .from('personas')
          .update({
            description: persona.description,
            tone: persona.tone,
            voice_name: persona.voice_name,
            image_url: persona.image_url
          })
          .eq('id', persona.id)
          .select();
        
        if (updateError) {
          throw new Error(`Failed to update persona ${persona.name}: ${updateError.message}`);
        }
        
        results.updated.push(...updatedData);
      }
      console.log(`✅ Successfully updated ${personasToUpdate.length} existing personas`);
    }
    
    // Display results
    if (results.inserted.length > 0) {
      console.log('\n📋 Inserted personas:');
      results.inserted.forEach(persona => {
        console.log(`  • ${persona.name} (${persona.id}) - Voice: ${persona.voice_name}`);
      });
    }
    
    if (results.updated.length > 0) {
      console.log('\n🔄 Updated personas:');
      results.updated.forEach(persona => {
        console.log(`  • ${persona.name} (${persona.id}) - Voice: ${persona.voice_name}`);
      });
    }
    
    if (results.inserted.length === 0 && results.updated.length === 0) {
      console.log('✅ All personas are already up to date');
    }
    
    console.log('\n🎉 Persona sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Error syncing personas:', error.message);
    process.exit(1);
  }
}

// Run the sync
syncPersonas(); 