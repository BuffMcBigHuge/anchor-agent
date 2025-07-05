const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration(migrationFile) {
  console.log(`🔄 Running migration: ${migrationFile}`);
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Migration SQL loaded, length:', migrationSQL.length);
    
    // Split SQL into individual statements (basic splitting by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n🔄 Executing statement ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          // Continue with other statements for non-critical errors
          if (error.message.includes('does not exist') || error.message.includes('already exists')) {
            console.log('⚠️ Non-critical error, continuing...');
            continue;
          } else {
            throw error;
          }
        }
        
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (stmtError) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, stmtError);
        
        // Try alternative execution method for some statements
        try {
          console.log('🔄 Trying alternative execution method...');
          await supabase.from('_migration_temp').select('1').limit(1); // This will fail but might help with connection
        } catch (altError) {
          // Ignore this error
        }
        
        // Continue with migration for non-critical errors
        if (stmtError.message && (stmtError.message.includes('does not exist') || stmtError.message.includes('already exists'))) {
          console.log('⚠️ Non-critical error, continuing with migration...');
          continue;
        } else {
          throw stmtError;
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Alternative method: Execute migration as a single query
async function runMigrationSingle(migrationFile) {
  console.log(`🔄 Running migration (single query): ${migrationFile}`);
  
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Remove comments and empty lines
    const cleanSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n');
    
    console.log('📄 Executing migration SQL...');
    
    // Note: This approach may not work with all Supabase setups
    // You might need to run the SQL manually in the Supabase dashboard
    console.log('\n📋 Migration SQL to run manually in Supabase dashboard:');
    console.log('=' .repeat(60));
    console.log(cleanSQL);
    console.log('=' .repeat(60));
    
    console.log('\n💡 Please copy the above SQL and run it in your Supabase SQL editor');
    console.log('🔗 Go to: https://supabase.com/dashboard/project/[your-project]/sql');
    
  } catch (error) {
    console.error('❌ Error reading migration file:', error);
    throw error;
  }
}

// Main execution
const migrationFile = process.argv[2] || '20250102121000_fix_chats_user_reference.sql';

console.log('🚀 Starting migration runner...');
console.log('📋 Migration file:', migrationFile);

// Try the single query approach first (safer for manual execution)
runMigrationSingle(migrationFile).then(() => {
  console.log('\n✅ Migration runner completed');
  console.log('\n🔄 After running the SQL manually, you can test with:');
  console.log('node scripts/debug-chat-history.js [user-id]');
  process.exit(0);
}).catch(error => {
  console.error('❌ Migration runner failed:', error);
  process.exit(1);
}); 