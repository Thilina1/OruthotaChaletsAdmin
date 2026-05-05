
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBatchCols() {
  const { data, error } = await supabase
    .from('inventory_batches')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error("Error batch columns:", error.message);
  } else {
    console.log("Batch columns:", Object.keys(data[0] || {}));
  }
}

checkBatchCols();
