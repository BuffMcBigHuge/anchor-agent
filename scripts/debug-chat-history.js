const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugChatHistory() {
  console.log('🔍 Debugging chat history issue...');
  
  try {
    // 1. Check if chats table exists and has data
    console.log('\n📊 Checking chats table...');
    const { data: allChats, error: allChatsError } = await supabase
      .from('chats')
      .select('id, user_id, title, created_at, messages')
      .limit(10);
    
    if (allChatsError) {
      console.error('❌ Error accessing chats table:', allChatsError);
      return;
    }
    
    console.log(`✅ Found ${allChats?.length || 0} total chats in database`);
    
    if (allChats && allChats.length > 0) {
      console.log('\n📋 Sample chats:');
      allChats.forEach((chat, index) => {
        console.log(`${index + 1}. ID: ${chat.id}`);
        console.log(`   User ID: ${chat.user_id}`);
        console.log(`   Title: ${chat.title}`);
        console.log(`   Messages: ${chat.messages?.length || 0}`);
        console.log(`   Created: ${chat.created_at}`);
        console.log('');
      });
      
      // 2. Check profiles table to see current user IDs
      console.log('\n👤 Checking profiles table...');
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .limit(10);
      
      if (profilesError) {
        console.error('❌ Error accessing profiles table:', profilesError);
      } else {
        console.log(`✅ Found ${profiles?.length || 0} profiles in database`);
        
        if (profiles && profiles.length > 0) {
          console.log('\n📋 Sample profiles:');
          profiles.forEach((profile, index) => {
            console.log(`${index + 1}. User ID: ${profile.user_id}`);
            console.log(`   Display Name: ${profile.display_name}`);
            console.log(`   Email: ${profile.email ? '[REDACTED]' : 'None'}`);
            console.log('');
          });
          
          // 3. Check if any profile user_ids match chat user_ids
          console.log('\n🔗 Checking user ID matches...');
          const profileUserIds = profiles.map(p => p.user_id);
          const chatUserIds = allChats.map(c => c.user_id);
          
          const matches = profileUserIds.filter(puid => chatUserIds.includes(puid));
          const profilesWithChats = matches.length;
          
          console.log(`📊 Profiles with matching chats: ${profilesWithChats}/${profiles.length}`);
          
          if (matches.length > 0) {
            console.log('✅ Found matching user IDs:', matches);
          } else {
            console.log('❌ No matching user IDs found between profiles and chats');
            console.log('🔍 Profile user IDs:', profileUserIds);
            console.log('🔍 Chat user IDs:', chatUserIds);
          }
        }
      }
    } else {
      console.log('📭 No chats found in database');
    }
    
    // 4. Check users table (if it exists and is being used)
    console.log('\n👥 Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .limit(5);
    
    if (usersError) {
      console.error('❌ Error accessing users table:', usersError);
    } else {
      console.log(`✅ Found ${users?.length || 0} users in users table`);
      if (users && users.length > 0) {
        console.log('📋 Sample users:');
        users.forEach((user, index) => {
          console.log(`${index + 1}. ID: ${user.id}, Name: ${user.name}`);
        });
      }
    }
    
    // 5. Check table schema information
    console.log('\n🏗️ Checking table schema...');
    
    // Check chats table constraints
    const { data: constraints, error: constraintsError } = await supabase
      .rpc('get_table_constraints', { table_name: 'chats' })
      .select('*');
    
    if (constraintsError) {
      console.log('⚠️ Could not fetch constraint information:', constraintsError.message);
    } else {
      console.log('📋 Chats table constraints:', constraints);
    }
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

// Helper function to test a specific user ID
async function testUserChatHistory(userId) {
  console.log(`\n🔍 Testing chat history for user: ${userId}`);
  
  try {
    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        *,
        personas (
          id,
          name,
          voice_name
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching chats:', error);
    } else {
      console.log(`✅ Found ${chats?.length || 0} chats for user ${userId}`);
      
      if (chats && chats.length > 0) {
        chats.forEach((chat, index) => {
          console.log(`${index + 1}. ${chat.title} (${chat.messages?.length || 0} messages)`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error testing user chat history:', error);
  }
}

// Run the debugging
debugChatHistory().then(() => {
  console.log('\n✅ Debugging complete');
  
  // If a user ID is provided as argument, test it specifically
  const testUserId = process.argv[2];
  if (testUserId) {
    testUserChatHistory(testUserId).then(() => {
      console.log('\n✅ User-specific test complete');
      process.exit(0);
    });
  } else {
    console.log('\n💡 To test a specific user ID, run: node scripts/debug-chat-history.js <user-id>');
    process.exit(0);
  }
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 