const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ysejulbuvunfhodersjr.supabase.co', 'sb_publishable_nn7GsENQXU_YmbYO7S8bUA_s8P4SVW5');
async function test() {
  const { data, error } = await supabase.from('inventory_brands').insert([{ name: 'TestBrandXYZ123' }]).select();
  console.log('Error:', error);
  console.log('Data:', data);
}
test();
