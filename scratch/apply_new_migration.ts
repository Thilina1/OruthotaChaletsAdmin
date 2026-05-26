import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing environment variables NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  try {
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260526000000_add_check_in_check_out_times.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing SQL migration...');
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      console.error('Error executing SQL migration:', error);
    } else {
      console.log('Migration successfully executed. Result:', data);
    }
  } catch (err) {
    console.error('Failed to run migration:', err);
  }
}

run();
