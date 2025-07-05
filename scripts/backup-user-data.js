const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.development') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backupUserData(userId) {
  console.log(`🔄 Starting backup for user: ${userId}`);
  
  try {
    // Step 1: Get user record
    console.log('📋 Fetching user record...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('uid', userId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user:', userError);
      return;
    }

    if (!user) {
      console.error('❌ User not found');
      return;
    }

    console.log(`✅ Found user: ${user.uid}`);

    // Step 2: Get user's chats
    console.log('📋 Fetching user chats...');
    const { data: chats, error: chatsError } = await supabase
      .from('chats')
      .select('*')
      .eq('uid', userId);

    if (chatsError) {
      console.error('❌ Error fetching chats:', chatsError);
      return;
    }

    console.log(`✅ Found ${chats.length} chats`);

    // Step 3: Get user's profile
    console.log('📋 Fetching user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('uid', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }

    console.log(`✅ ${profile ? 'Found' : 'No'} profile`);

    // Step 4: Extract all persona IDs from chats and profile
    console.log('📋 Extracting persona references...');
    const personaIds = new Set();
    
    // From chats
    chats.forEach(chat => {
      if (chat.persona_id) {
        personaIds.add(chat.persona_id);
      }
      
      // From chat messages
      if (chat.messages && Array.isArray(chat.messages)) {
        chat.messages.forEach(message => {
          if (message.persona_id) {
            personaIds.add(message.persona_id);
          }
        });
      }
    });

    // From profile
    if (profile && profile.persona_id) {
      personaIds.add(profile.persona_id);
    }

    console.log(`✅ Found ${personaIds.size} unique persona references`);

    // Step 5: Fetch all referenced personas
    console.log('📋 Fetching personas...');
    const { data: personas, error: personasError } = await supabase
      .from('personas')
      .select('*')
      .in('id', Array.from(personaIds));

    if (personasError) {
      console.error('❌ Error fetching personas:', personasError);
      return;
    }

    console.log(`✅ Found ${personas.length} personas`);

    // Step 6: Create backup object
    const backupData = {
      metadata: {
        backup_date: new Date().toISOString(),
        original_user_id: userId,
        schema_version: 'legacy_uid_system',
        total_chats: chats.length,
        total_personas: personas.length,
        has_profile: !!profile
      },
      user: user,
      profile: profile,
      chats: chats,
      personas: personas
    };

    // Step 7: Save to file
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `user_backup_${userId}_${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

    console.log('✅ Backup completed successfully!');
    console.log(`📁 Backup saved to: ${filepath}`);
    console.log('\n📊 Backup Summary:');
    console.log(`   User ID: ${userId}`);
    console.log(`   Chats: ${chats.length}`);
    console.log(`   Personas: ${personas.length}`);
    console.log(`   Profile: ${profile ? 'Yes' : 'No'}`);
    
    return filepath;

  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

// Run the backup
const userId = process.argv[2] || '7d2e7672-a233-4f3e-bb2d-5204fbf1df51';

if (!userId) {
  console.error('❌ Please provide a user ID as an argument');
  console.log('Usage: node scripts/backup-user-data.js [user-id]');
  process.exit(1);
}

backupUserData(userId)
  .then((filepath) => {
    console.log('\n🎉 Backup process completed successfully!');
    console.log(`📋 Next steps:`);
    console.log(`   1. Run: npx supabase db reset`);
    console.log(`   2. Run: node scripts/restore-user-data.js "${filepath}"`);
  })
  .catch((error) => {
    console.error('\n💥 Backup process failed:', error);
    process.exit(1);
  }); 